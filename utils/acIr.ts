export type AcBrand = 'Tosot' | 'Gree' | 'LG' | 'Samsung' | 'Midea';

export type AcMode = 'Auto' | 'Cool' | 'Heat' | 'Dry' | 'Fan';
export type AcFan = 'Auto' | 'Low' | 'Medium' | 'High';

export interface AcState {
  power: boolean;
  temperature: number;
  mode: AcMode;
  fan: AcFan;
  swing: boolean;
  turbo: boolean;
  sleep: boolean;
}

export interface AcIrPattern {
  carrierFrequency: number;
  pattern: number[];
}

const MODE_INDEX: Record<AcMode, number> = {
  Auto: 0,
  Cool: 1,
  Heat: 2,
  Dry: 3,
  Fan: 4,
};

const FAN_INDEX: Record<AcFan, number> = {
  Auto: 0,
  Low: 1,
  Medium: 2,
  High: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pushByte(pattern: number[], value: number): void {
  for (let bit = 0; bit < 8; bit += 1) {
    pattern.push(560);
    pattern.push((value >> bit) & 1 ? 1690 : 560);
  }
}

function necFrame(address: number, bytes: number[]): number[] {
  const pattern: number[] = [9000, 4500];
  pushByte(pattern, address & 0xff);
  pushByte(pattern, (address >> 8) & 0xff);
  bytes.forEach((byte) => pushByte(pattern, byte & 0xff));
  pattern.push(560);
  return pattern;
}

function joinFrames(frames: number[][]): number[] {
  return frames.flatMap((frame, index) =>
    index === 0 ? frame : [...frame, 40000],
  );
}

function greekLikeBytes(state: AcState): number[] {
  const temp = clamp(state.temperature - 16, 0, 14);
  const mode = MODE_INDEX[state.mode];
  const fan = FAN_INDEX[state.fan];
  const power = state.power ? 0x80 : 0x00;
  const first = power | (mode << 4) | temp;
  const second =
    (fan << 4) |
    (state.swing ? 0x08 : 0) |
    (state.turbo ? 0x04 : 0) |
    (state.sleep ? 0x02 : 0);
  const checksum = (first + second) & 0xff;
  return [0, 0, 0, 0, first, second, checksum, 0];
}

function buildProfileBytes(brand: AcBrand, state: AcState): number[] | null {
  const mode = MODE_INDEX[state.mode];
  const fan = FAN_INDEX[state.fan];
  const temp = clamp(state.temperature - 16, 0, 14);
  const flags =
    (state.swing ? 0x20 : 0) |
    (state.turbo ? 0x10 : 0) |
    (state.sleep ? 0x08 : 0);

  if (brand === 'Gree' || brand === 'Tosot') {
    return greekLikeBytes(state);
  }
  if (brand === 'LG') {
    return [state.power ? 0x80 : 0, mode << 4, temp, fan << 4, flags];
  }
  if (brand === 'Samsung') {
    return [state.power ? 0x02 : 0, mode, temp, fan, flags];
  }
  if (brand === 'Midea') {
    return [state.power ? 0x80 : 0, mode, temp, fan, flags, 0];
  }
  return null;
}

function profileAddress(brand: AcBrand): number {
  switch (brand) {
    case 'LG':
      return 0xfb00;
    case 'Samsung':
      return 0x0707;
    case 'Midea':
      return 0xe30e;
    case 'Tosot':
      return 0x00f0;
    case 'Gree':
    default:
      return 0x0000;
  }
}

export function buildAcIrPattern(
  brand: AcBrand,
  state: AcState,
  carrierFrequency = 38000,
): AcIrPattern {
  const bytes = buildProfileBytes(brand, state) ?? [];
  const address = profileAddress(brand);
  const pattern = state.power
    ? joinFrames([necFrame(address, bytes), necFrame(address, bytes)])
    : necFrame(address, bytes);

  return { carrierFrequency, pattern };
}
