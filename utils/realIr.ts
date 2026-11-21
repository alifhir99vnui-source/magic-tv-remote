export interface IrSignal {
  carrierFrequency: number;
  pattern: number[];
}

export interface AcSignalState {
  power: boolean;
  temperature: number;
  mode: 'Auto' | 'Cool' | 'Heat' | 'Dry' | 'Fan';
  fan: 'Auto' | 'Low' | 'Medium' | 'High';
  swing: boolean;
  turbo: boolean;
  sleep: boolean;
  eco: boolean;
  ledOff: boolean;
  sleepTimer: number;
}

export type AcSignalCodeSet = 1 | 2 | 3;
export type AcSignalFamily = 'yap' | 'midea' | 'nec' | 'lgac' | 'kaseikyo';

type TransmitFn = (carrierFrequency: number, pattern: number[]) => Promise<boolean> | boolean;

const GREE_MODE: Record<AcSignalState['mode'], number> = { Auto: 0, Cool: 1, Dry: 2, Fan: 3, Heat: 4 };
const GREE_FAN: Record<AcSignalState['fan'], number> = { Auto: 0, Low: 1, Medium: 2, High: 3 };
const MIDEA_MODE: Record<AcSignalState['mode'], number> = { Cool: 0, Dry: 1, Auto: 2, Heat: 3, Fan: 4 };
const NEC_MODE: Record<AcSignalState['mode'], number> = { Auto: 0, Cool: 1, Heat: 2, Dry: 3, Fan: 4 };
const NEC_FAN: Record<AcSignalState['fan'], number> = { Auto: 0, Low: 1, Medium: 2, High: 3 };

const NEC_ADDRESSES: Record<string, Record<AcSignalCodeSet, { low: number; high: number }>> = {
  LG: {
    1: { low: 0x00, high: 0xfb },
    2: { low: 0x20, high: 0xdf },
    3: { low: 0x40, high: 0xbf },
  },
  Samsung: {
    1: { low: 0x07, high: 0x07 },
    2: { low: 0x0f, high: 0xf0 },
    3: { low: 0x1f, high: 0xe0 },
  },
  Toshiba: {
    1: { low: 0x00, high: 0x40 },
    2: { low: 0x10, high: 0xef },
    3: { low: 0x30, high: 0xcf },
  },
};

const MAGIC_ADDRESSES: Record<AcSignalCodeSet, { low: number; high: number }> = {
  1: { low: 0x00, high: 0xff },
  2: { low: 0x80, high: 0x7f },
  3: { low: 0x01, high: 0xfe },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pushLsb(pattern: number[], value: number, mark: number, one: number, zero: number): void {
  for (let bit = 0; bit < 8; bit += 1) pattern.push(mark, ((value >> bit) & 1) ? one : zero);
}

function pushMsb(pattern: number[], value: number, bits: number, mark: number, one: number, zero: number): void {
  for (let bit = bits - 1; bit >= 0; bit -= 1) pattern.push(mark, ((value >> bit) & 1) ? one : zero);
}

function reverseByte(value: number): number {
  let result = 0;
  for (let bit = 0; bit < 8; bit += 1) result = (result << 1) | ((value >> bit) & 1);
  return result & 0xff;
}

function necPattern(bytes: number[], carrierFrequency: number): IrSignal {
  const pattern: number[] = [9000, 4500];
  for (const byte of bytes) pushLsb(pattern, byte & 0xff, 560, 1690, 560);
  pattern.push(560, 40000);
  return { carrierFrequency, pattern };
}

function yapBytes(state: AcSignalState, codeSet: AcSignalCodeSet): number[] {
  const temp = clamp(state.temperature - 16, 0, 14);
  const fixed = codeSet === 1 ? [0x82, 0x20] : codeSet === 2 ? [0x42, 0x60] : [0xc2, 0xa0];
  const bytes = [
    (GREE_MODE[state.mode] & 0x07) |
      (state.power ? 0x08 : 0) |
      ((GREE_FAN[state.fan] & 0x03) << 4) |
      (state.swing ? 0x40 : 0) |
      (state.sleep || state.sleepTimer > 0 ? 0x80 : 0),
    temp & 0x0f,
    (state.turbo ? 0x10 : 0) |
      (state.eco ? 0x08 : 0) |
      (state.ledOff ? 0x04 : 0) |
      0x20,
    0x50,
    state.swing ? 0x01 : 0x00,
    fixed[0],
    fixed[1],
    0x00,
  ];
  let sum = 0x0a + (codeSet - 1);
  for (let i = 0; i < 4; i += 1) sum += bytes[i] & 0x0f;
  for (let i = 4; i < 7; i += 1) sum += bytes[i] >> 4;
  bytes[7] = (sum & 0x0f) << 4;
  return bytes;
}

function tosotYap(state: AcSignalState, codeSet: AcSignalCodeSet, carrierFrequency: number): IrSignal {
  const bytes = yapBytes(state, codeSet);
  const pattern: number[] = [9000, 4450];
  for (const byte of bytes.slice(0, 4)) pushLsb(pattern, byte, 650, 1650, 550);
  pattern.push(650, 19980);
  for (const byte of bytes.slice(4)) pushLsb(pattern, byte, 650, 1650, 550);
  pattern.push(650, 19980);
  return { carrierFrequency, pattern };
}

function mideaBytes(state: AcSignalState, codeSet: AcSignalCodeSet, brand: string): number[] {
  const temp = clamp(state.temperature - 17, 0, 15);
  const brandTail =
    brand === 'General' || brand === 'O General'
      ? 0x05
      : brand === 'AUX'
        ? 0x04
        : brand === 'Denka' || brand === 'Craft'
          ? 0x03
          : 0x01;
  const bytes = [
    0x00,
    0xff,
    0xff,
    temp & 0x1f,
    (MIDEA_MODE[state.mode] & 0x07) |
      ((GREE_FAN[state.fan] & 0x03) << 3) |
      (state.swing ? 0x04 : 0) |
      (state.sleep || state.sleepTimer > 0 ? 0x40 : 0) |
      (state.power ? 0x80 : 0),
    ((0x14 + codeSet - 1) << 3) |
      brandTail |
      (state.turbo ? 0x20 : 0) |
      (state.eco ? 0x40 : 0) |
      (state.ledOff ? 0x80 : 0),
  ];
  let sum = 0;
  for (let i = 1; i < bytes.length; i += 1) sum += reverseByte(bytes[i]);
  bytes[0] = reverseByte((0 - sum) & 0xff);
  return bytes;
}

function midea48(state: AcSignalState, codeSet: AcSignalCodeSet, brand: string, carrierFrequency: number): IrSignal {
  const bytes = mideaBytes(state, codeSet, brand);
  const pattern: number[] = [];
  for (const frame of [bytes, bytes.map((value) => ~value & 0xff)]) {
    pattern.push(4480, 4480);
    for (const byte of frame) pushMsb(pattern, byte, 8, 560, 1680, 560);
    pattern.push(560, 5600);
  }
  pattern.push(40000);
  return { carrierFrequency, pattern };
}

function necAc(brand: string, state: AcSignalState, codeSet: AcSignalCodeSet, carrierFrequency: number): IrSignal {
  const address = NEC_ADDRESSES[brand]?.[codeSet] ?? { low: 0x00, high: 0x00 };
  const temperatureByte =
    (clamp(state.temperature - 16, 0, 14) & 0x0f) | ((NEC_FAN[state.fan] & 0x03) << 4);
  const flagsByte =
    (NEC_MODE[state.mode] & 0x07) |
    (state.power ? 0x08 : 0) |
    (state.swing ? 0x10 : 0) |
    (state.turbo ? 0x20 : 0) |
    (state.eco ? 0x40 : 0) |
    (state.ledOff ? 0x80 : 0) |
    (state.sleep || state.sleepTimer > 0 ? 0x01 : 0);
  const pattern: number[] = [];
  for (const command of [temperatureByte, flagsByte]) {
    pattern.push(9000, 4500);
    for (const byte of [address.low, address.high, command, ~command & 0xff]) {
      pushLsb(pattern, byte, 560, 1690, 560);
    }
    pattern.push(560, 40000);
  }
  return { carrierFrequency, pattern };
}

function lgAc(state: AcSignalState, carrierFrequency: number): IrSignal {
  const temp = clamp(state.temperature - 16, 0, 30);
  const mode = NEC_MODE[state.mode] & 0x07;
  const fan = NEC_FAN[state.fan] & 0x03;
  const value =
    ((0x88 + (state.power ? 1 : 0)) << 20) |
    ((temp & 0x1f) << 14) |
    ((mode & 0x07) << 11) |
    ((fan & 0x03) << 9) |
    ((state.swing ? 1 : 0) << 8) |
    ((state.turbo ? 1 : 0) << 7) |
    ((state.eco ? 1 : 0) << 6) |
    ((state.ledOff ? 1 : 0) << 5) |
    ((state.sleep || state.sleepTimer > 0 ? 1 : 0) << 4);
  const pattern: number[] = [9000, 4450];
  pushMsb(pattern, value & 0x0fffffff, 28, 560, 1690, 560);
  pattern.push(560, 40000);
  return { carrierFrequency, pattern };
}

function kaseikyo(state: AcSignalState, carrierFrequency: number): IrSignal {
  const vendor = 0x4004;
  const command =
    (NEC_MODE[state.mode] & 0x07) |
    ((NEC_FAN[state.fan] & 0x03) << 3) |
    (state.swing ? 0x20 : 0) |
    (state.turbo ? 0x40 : 0) |
    (state.eco ? 0x80 : 0);
  const temperature = clamp(state.temperature - 16, 0, 30) & 0x1f;
  const subDevice = temperature | (state.power ? 0x20 : 0) | (state.ledOff ? 0x40 : 0);
  const bytes = [(vendor >> 8) & 0xff, vendor & 0xff, subDevice, command];
  let parity = 0;
  for (const byte of bytes) parity ^= byte;
  const pattern: number[] = [9000, 4500];
  for (const byte of bytes) pushMsb(pattern, byte, 8, 560, 1690, 560);
  pushMsb(pattern, ~command & 0xff, 8, 560, 1690, 560);
  pushMsb(pattern, parity & 0xff, 8, 560, 1690, 560);
  pattern.push(560, 40000);
  return { carrierFrequency, pattern };
}

export class RealIrController {
  private readonly transmit?: TransmitFn;

  constructor(transmit?: TransmitFn) {
    this.transmit = transmit;
  }

  async send(signal: IrSignal): Promise<boolean> {
    if (!this.transmit || !signal.pattern.length) return false;
    try {
      return Boolean(await Promise.resolve(this.transmit(signal.carrierFrequency, signal.pattern)));
    } catch {
      return false;
    }
  }

  static nec(lowAddress: number, highAddress: number, command: number, carrierFrequency = 38000): IrSignal {
    return necPattern([lowAddress & 0xff, highAddress & 0xff, command & 0xff, ~command & 0xff], carrierFrequency);
  }

  static necExtended(lowAddress: number, highAddress: number, command: number, carrierFrequency = 38000): IrSignal {
    return necPattern(
      [
        lowAddress & 0xff,
        highAddress & 0xff,
        (command >> 8) & 0xff,
        command & 0xff,
        ~command & 0xff,
      ],
      carrierFrequency,
    );
  }

  static magicNec(codeSet: AcSignalCodeSet, command: number, carrierFrequency = 38000): IrSignal {
    const address = MAGIC_ADDRESSES[codeSet];
    return RealIrController.nec(address.low, address.high, command, carrierFrequency);
  }

  static samsung32(address: number, command: number, carrierFrequency = 38000): IrSignal {
    const pattern: number[] = [9000, 4500];
    pushMsb(pattern, address & 0xffff, 16, 560, 1690, 560);
    pushMsb(pattern, command & 0xff, 8, 560, 1690, 560);
    pushMsb(pattern, ~command & 0xff, 8, 560, 1690, 560);
    pattern.push(560, 40000);
    return { carrierFrequency, pattern };
  }

  static sony(command: number, bits: 12 | 15 = 12, carrierFrequency = 40000): IrSignal {
    const pattern: number[] = [2400, 600];
    pushMsb(pattern, command, bits, 600, 1200, 600);
    pattern.push(600, 40000);
    return { carrierFrequency, pattern };
  }

  static rc5(address: number, command: number, toggle = 0, carrierFrequency = 36000): IrSignal {
    const value = 0x1800 | ((toggle & 1) << 11) | ((address & 0x1f) << 6) | (command & 0x3f);
    const half = 889;
    const pattern: number[] = [half];
    let state = false;
    let duration = half;
    const setLevel = (next: boolean) => {
      if (next === state) {
        duration += half;
        return;
      }
      pattern.push(duration);
      state = next;
      duration = half;
    };
    for (let bit = 13; bit >= 0; bit -= 1) {
      if ((value >> bit) & 1) {
        setLevel(false);
        setLevel(true);
      } else {
        setLevel(true);
        setLevel(false);
      }
    }
    pattern.push(duration);
    return { carrierFrequency, pattern };
  }

  static tosotYap(state: AcSignalState, codeSet: AcSignalCodeSet, carrierFrequency = 38000): IrSignal {
    return tosotYap(state, codeSet, carrierFrequency);
  }

  static midea48(
    state: AcSignalState,
    codeSet: AcSignalCodeSet,
    brand: string,
    carrierFrequency = 38000,
  ): IrSignal {
    return midea48(state, codeSet, brand, carrierFrequency);
  }

  static lgAc(state: AcSignalState, carrierFrequency = 38000): IrSignal {
    return lgAc(state, carrierFrequency);
  }

  static panasonicAc(state: AcSignalState, carrierFrequency = 37000): IrSignal {
    return kaseikyo(state, carrierFrequency);
  }

  static ac(
    brand: string,
    family: AcSignalFamily,
    state: AcSignalState,
    codeSet: AcSignalCodeSet,
    carrierFrequency = 38000,
  ): IrSignal {
    if (family === 'yap') return tosotYap(state, codeSet, carrierFrequency);
    if (family === 'midea') return midea48(state, codeSet, brand, carrierFrequency);
    if (family === 'lgac') return lgAc(state, carrierFrequency);
    if (family === 'kaseikyo') return kaseikyo(state, carrierFrequency);
    return necAc(brand, state, codeSet, carrierFrequency);
  }
}
