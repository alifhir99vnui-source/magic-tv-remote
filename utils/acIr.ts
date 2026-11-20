export type AcBrand = 'Tosot' | 'AlHafidh' | 'Midea' | 'LG' | 'Samsung' | 'Toshiba';

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

export interface AcBrandProfile {
  brand: AcBrand;
  label: string;
  protocol: string;
  detail: string;
  minTemperature: number;
  maxTemperature: number;
}

export const AC_MIN_TEMPERATURE = 16;
export const AC_MAX_TEMPERATURE = 30;

export const AC_BRANDS: AcBrandProfile[] = [
  {
    brand: 'Tosot',
    label: 'Tosot',
    protocol: 'YAC1FB1',
    detail: 'بروتوكول Gree/YAC الكامل — إطار 8 بايت مع تحقق المجموع',
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'AlHafidh',
    label: 'الحافظ',
    protocol: 'Midea 48-bit',
    detail: 'متوافق مع أجهزة الحافظ المبنية على منصة Midea',
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Midea',
    label: 'Midea',
    protocol: 'Midea 48-bit',
    detail: 'إطار 48 بت مع الإطار المعكوس والتحقق',
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'LG',
    label: 'LG',
    protocol: 'NEC / LG',
    detail: 'أكواد LG الشائعة بصيغة NEC',
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Samsung',
    label: 'Samsung',
    protocol: 'NEC / Samsung',
    detail: 'أكواد Samsung الشائعة بصيغة NEC',
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Toshiba',
    label: 'Toshiba',
    protocol: 'NEC / Toshiba',
    detail: 'أكواد Toshiba الشائعة بصيغة NEC',
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
];

export const AC_MODES: AcMode[] = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
export const AC_FANS: AcFan[] = ['Auto', 'Low', 'Medium', 'High'];

const GREE_MODE: Record<AcMode, number> = {
  Auto: 0,
  Cool: 1,
  Dry: 2,
  Fan: 3,
  Heat: 4,
};

const GREE_FAN: Record<AcFan, number> = {
  Auto: 0,
  Low: 1,
  Medium: 2,
  High: 3,
};

const MIDEA_MODE: Record<AcMode, number> = {
  Cool: 0,
  Dry: 1,
  Auto: 2,
  Heat: 3,
  Fan: 4,
};

const NEC_MODE: Record<AcMode, number> = {
  Auto: 0,
  Cool: 1,
  Heat: 2,
  Dry: 3,
  Fan: 4,
};

const NEC_FAN: Record<AcFan, number> = {
  Auto: 0,
  Low: 1,
  Medium: 2,
  High: 3,
};

const NEC_ADDRESSES: Partial<Record<AcBrand, { low: number; high: number }>> = {
  LG: { low: 0x00, high: 0xfb },
  Samsung: { low: 0x07, high: 0x07 },
  Toshiba: { low: 0x00, high: 0x40 },
};

const YAC_HDR_MARK = 9000;
const YAC_HDR_SPACE = 4450;
const YAC_BIT_MARK = 650;
const YAC_ONE_SPACE = 1650;
const YAC_ZERO_SPACE = 550;
const YAC_BLOCK_GAP = 19980;

const MIDEA_HDR = 4480;
const MIDEA_BIT_MARK = 560;
const MIDEA_ONE = 1680;
const MIDEA_ZERO = 560;
const MIDEA_GAP = 5600;

const NEC_HDR_MARK = 9000;
const NEC_HDR_SPACE = 4500;
const NEC_BIT_MARK = 560;
const NEC_ONE_SPACE = 1690;
const NEC_ZERO_SPACE = 560;
const NEC_GAP = 40000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pushBit(pattern: number[], bit: number, one: number, zero: number, mark: number): void {
  pattern.push(mark, bit ? one : zero);
}

function pushLsbByte(
  pattern: number[],
  value: number,
  mark = YAC_BIT_MARK,
  one = YAC_ONE_SPACE,
  zero = YAC_ZERO_SPACE,
): void {
  for (let bit = 0; bit < 8; bit += 1) {
    pushBit(pattern, (value >> bit) & 1, one, zero, mark);
  }
}

function pushMsbByte(
  pattern: number[],
  value: number,
  mark = MIDEA_BIT_MARK,
  one = MIDEA_ONE,
  zero = MIDEA_ZERO,
): void {
  for (let bit = 7; bit >= 0; bit -= 1) {
    pushBit(pattern, (value >> bit) & 1, one, zero, mark);
  }
}

function reverseByte(value: number): number {
  let result = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    result = (result << 1) | ((value >> bit) & 1);
  }
  return result & 0xff;
}

function yac1fb1Bytes(state: AcState): number[] {
  const temp = clamp(state.temperature - 16, 0, 14);
  const bytes = [
    (GREE_MODE[state.mode] & 0x07) |
      (state.power ? 0x08 : 0) |
      ((GREE_FAN[state.fan] & 0x03) << 4) |
      (state.swing ? 0x40 : 0) |
      (state.sleep ? 0x80 : 0),
    temp & 0x0f,
    (state.turbo ? 0x10 : 0) | 0x20,
    0x50,
    state.swing ? 0x01 : 0x00,
    0x82,
    0x20,
    0x00,
  ];

  let sum = 0x0a;
  for (let i = 0; i < 4; i += 1) sum += bytes[i] & 0x0f;
  for (let i = 4; i < 7; i += 1) sum += bytes[i] >> 4;
  bytes[7] = (sum & 0x0f) << 4;
  return bytes;
}

function buildYac1fb1(state: AcState): number[] {
  const bytes = yac1fb1Bytes(state);
  const pattern: number[] = [YAC_HDR_MARK, YAC_HDR_SPACE];

  for (const byte of bytes.slice(0, 4)) pushLsbByte(pattern, byte);
  for (const bit of [0, 1, 0]) {
    pushBit(pattern, bit, YAC_ONE_SPACE, YAC_ZERO_SPACE, YAC_BIT_MARK);
  }
  pattern.push(YAC_BIT_MARK, YAC_BLOCK_GAP);

  for (const byte of bytes.slice(4)) pushLsbByte(pattern, byte);
  pattern.push(YAC_BIT_MARK, YAC_BLOCK_GAP);
  return pattern;
}

function mideaBytes(state: AcState): number[] {
  const temp = clamp(state.temperature - 17, 0, 15);
  const bytes = [
    0x00,
    0xff,
    0xff,
    temp & 0x1f,
    (MIDEA_MODE[state.mode] & 0x07) |
      ((GREE_FAN[state.fan] & 0x03) << 3) |
      (state.sleep ? 0x40 : 0) |
      (state.power ? 0x80 : 0),
    (0x14 << 3) | 0x01,
  ];

  let sum = 0;
  for (let i = 1; i < bytes.length; i += 1) sum += reverseByte(bytes[i]);
  bytes[0] = reverseByte((0 - sum) & 0xff);
  return bytes;
}

function buildMidea(state: AcState): number[] {
  const bytes = mideaBytes(state);
  const pattern: number[] = [];

  for (const frame of [bytes, bytes.map((value) => ~value & 0xff)]) {
    pattern.push(MIDEA_HDR, MIDEA_HDR);
    for (const byte of frame) pushMsbByte(pattern, byte);
    pattern.push(MIDEA_BIT_MARK, MIDEA_GAP);
  }
  pattern.push(NEC_GAP);
  return pattern;
}

function buildNec(brand: AcBrand, state: AcState): number[] {
  const address = NEC_ADDRESSES[brand] ?? { low: 0x00, high: 0x00 };
  const temperatureByte =
    (clamp(state.temperature - AC_MIN_TEMPERATURE, 0, 14) & 0x0f) |
    ((NEC_FAN[state.fan] & 0x03) << 4);
  const flagsByte =
    (NEC_MODE[state.mode] & 0x07) |
    (state.power ? 0x08 : 0) |
    (state.swing ? 0x10 : 0) |
    (state.turbo ? 0x20 : 0) |
    (state.sleep ? 0x40 : 0);

  const pattern: number[] = [];
  for (const command of [temperatureByte, flagsByte]) {
    pattern.push(NEC_HDR_MARK, NEC_HDR_SPACE);
    for (const byte of [address.low, address.high, command, ~command & 0xff]) {
      pushLsbByte(pattern, byte, NEC_BIT_MARK, NEC_ONE_SPACE, NEC_ZERO_SPACE);
    }
    pattern.push(NEC_BIT_MARK, NEC_GAP);
  }
  return pattern;
}

export function buildAcIrPattern(
  brand: AcBrand,
  state: AcState,
  carrierFrequency = 38000,
): AcIrPattern {
  let pattern: number[];
  switch (brand) {
    case 'Tosot':
      pattern = buildYac1fb1(state);
      break;
    case 'AlHafidh':
    case 'Midea':
      pattern = buildMidea(state);
      break;
    case 'LG':
    case 'Samsung':
    case 'Toshiba':
      pattern = buildNec(brand, state);
      break;
    default:
      pattern = buildYac1fb1(state);
      break;
  }
  return { carrierFrequency, pattern };
}

export function getAcBrandProfile(brand: AcBrand): AcBrandProfile {
  return AC_BRANDS.find((profile) => profile.brand === brand) ?? AC_BRANDS[0];
}
