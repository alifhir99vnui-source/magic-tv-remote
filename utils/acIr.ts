export type AcBrand =
  | 'Tosot'
  | 'AlHafidh'
  | 'Midea'
  | 'LG'
  | 'Samsung'
  | 'Toshiba'
  | 'Gree'
  | 'Denka'
  | 'AUX'
  | 'General';

export type AcCodeSet = 1 | 2 | 3;
export type AcMode = 'Auto' | 'Cool' | 'Heat' | 'Dry' | 'Fan';
export type AcFan = 'Auto' | 'Low' | 'Medium' | 'High';
export type AcProtocolFamily = 'yap' | 'midea' | 'nec';

export interface AcState {
  power: boolean;
  temperature: number;
  mode: AcMode;
  fan: AcFan;
  swing: boolean;
  turbo: boolean;
  sleep: boolean;
  eco: boolean;
  ledOff: boolean;
  sleepTimer: number;
}

export interface AcIrPattern {
  carrierFrequency: number;
  pattern: number[];
}

export interface AcBrandProfile {
  brand: AcBrand;
  label: { ar: string; en: string };
  protocol: string;
  family: AcProtocolFamily;
  detail: { ar: string; en: string };
  minTemperature: number;
  maxTemperature: number;
}

export const AC_MIN_TEMPERATURE = 16;
export const AC_MAX_TEMPERATURE = 30;
export const AC_SLEEP_TIMERS = [0, 30, 60, 120];

export const AC_BRANDS: AcBrandProfile[] = [
  {
    brand: 'Tosot',
    label: { ar: 'توسوت', en: 'Tosot' },
    protocol: 'YAC1FB1',
    family: 'yap',
    detail: { ar: 'بروتوكول Gree/YAP الكامل بإطار 8 بايت والمجموع التحققي', en: 'Full Gree/YAP 8-byte frame with checksum' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'AlHafidh',
    label: { ar: 'الحافظ', en: 'Al-Hafidh' },
    protocol: 'Midea 48-bit',
    family: 'midea',
    detail: { ar: 'بروتوكول Midea 48 بت مع الإطار المعكوس', en: 'Midea 48-bit protocol with inverted frame' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Midea',
    label: { ar: 'ميديا', en: 'Midea' },
    protocol: 'Midea 48-bit',
    family: 'midea',
    detail: { ar: 'إطار 48 بت مع التحقق والمجموع المعكوس', en: '48-bit frame with reversed checksum' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'LG',
    label: { ar: 'إل جي', en: 'LG' },
    protocol: 'NEC / LG',
    family: 'nec',
    detail: { ar: 'أكواد LG بصيغة NEC 32 بت', en: 'LG 32-bit NEC-compatible codes' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Samsung',
    label: { ar: 'سامسونج', en: 'Samsung' },
    protocol: 'NEC / Samsung',
    family: 'nec',
    detail: { ar: 'أكواد سامسونج بصيغة NEC 32 بت', en: 'Samsung 32-bit NEC-compatible codes' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Toshiba',
    label: { ar: 'توشيبا', en: 'Toshiba' },
    protocol: 'NEC / Toshiba',
    family: 'nec',
    detail: { ar: 'أكواد توشيبا بصيغة NEC 32 بت', en: 'Toshiba 32-bit NEC-compatible codes' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Gree',
    label: { ar: 'جري', en: 'Gree' },
    protocol: 'YAC1FB1',
    family: 'yap',
    detail: { ar: 'بروتوكول YAC1FB1 المستخدم في أجهزة جري', en: 'YAC1FB1 protocol used by Gree units' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Denka',
    label: { ar: 'دنكا', en: 'Denka' },
    protocol: 'Midea-compatible',
    family: 'midea',
    detail: { ar: 'متوافق مع منصة Midea للتحكم بالسبلت', en: 'Midea-compatible AC control platform' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'AUX',
    label: { ar: 'أوكس', en: 'AUX' },
    protocol: 'Midea-compatible',
    family: 'midea',
    detail: { ar: 'متوافق مع بروتوكول Midea المستخدم في AUX', en: 'Midea-compatible protocol used by AUX' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'General',
    label: { ar: 'جنرال / أو جنرال', en: 'General / O General' },
    protocol: 'Midea-compatible',
    family: 'midea',
    detail: { ar: 'بروتوكول Midea مع مجموعات أكواد General', en: 'Midea protocol with General code sets' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
];

export const AC_MODES: AcMode[] = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
export const AC_FANS: AcFan[] = ['Auto', 'Low', 'Medium', 'High'];
export const AC_CODE_SETS: AcCodeSet[] = [1, 2, 3];

const GREE_MODE: Record<AcMode, number> = { Auto: 0, Cool: 1, Dry: 2, Fan: 3, Heat: 4 };
const GREE_FAN: Record<AcFan, number> = { Auto: 0, Low: 1, Medium: 2, High: 3 };
const MIDEA_MODE: Record<AcMode, number> = { Cool: 0, Dry: 1, Auto: 2, Heat: 3, Fan: 4 };
const NEC_MODE: Record<AcMode, number> = { Auto: 0, Cool: 1, Heat: 2, Dry: 3, Fan: 4 };
const NEC_FAN: Record<AcFan, number> = { Auto: 0, Low: 1, Medium: 2, High: 3 };

const NEC_ADDRESSES: Record<string, Record<AcCodeSet, { low: number; high: number }>> = {
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

function pushLsbByte(pattern: number[], value: number, mark: number, one: number, zero: number): void {
  for (let bit = 0; bit < 8; bit += 1) pushBit(pattern, (value >> bit) & 1, one, zero, mark);
}

function pushMsbByte(pattern: number[], value: number, mark: number, one: number, zero: number): void {
  for (let bit = 7; bit >= 0; bit -= 1) pushBit(pattern, (value >> bit) & 1, one, zero, mark);
}

function reverseByte(value: number): number {
  let result = 0;
  for (let bit = 0; bit < 8; bit += 1) result = (result << 1) | ((value >> bit) & 1);
  return result & 0xff;
}

function yapBytes(state: AcState, codeSet: AcCodeSet): number[] {
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

function buildYap(state: AcState, codeSet: AcCodeSet): number[] {
  const bytes = yapBytes(state, codeSet);
  const pattern: number[] = [YAC_HDR_MARK, YAC_HDR_SPACE];
  for (const byte of bytes.slice(0, 4)) {
    pushLsbByte(pattern, byte, YAC_BIT_MARK, YAC_ONE_SPACE, YAC_ZERO_SPACE);
  }
  for (const bit of [0, 1, 0]) {
    pushBit(pattern, bit, YAC_ONE_SPACE, YAC_ZERO_SPACE, YAC_BIT_MARK);
  }
  pattern.push(YAC_BIT_MARK, YAC_BLOCK_GAP);
  for (const byte of bytes.slice(4)) {
    pushLsbByte(pattern, byte, YAC_BIT_MARK, YAC_ONE_SPACE, YAC_ZERO_SPACE);
  }
  pattern.push(YAC_BIT_MARK, YAC_BLOCK_GAP);
  return pattern;
}

function mideaBytes(state: AcState, codeSet: AcCodeSet, brand: AcBrand): number[] {
  const temp = clamp(state.temperature - 17, 0, 15);
  const brandTail = brand === 'General' ? 0x05 : brand === 'AUX' ? 0x04 : brand === 'Denka' ? 0x03 : 0x01;
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
    ((0x14 + codeSet - 1) << 3) | brandTail |
      (state.turbo ? 0x20 : 0) |
      (state.eco ? 0x40 : 0) |
      (state.ledOff ? 0x80 : 0),
  ];
  let sum = 0;
  for (let i = 1; i < bytes.length; i += 1) sum += reverseByte(bytes[i]);
  bytes[0] = reverseByte((0 - sum) & 0xff);
  return bytes;
}

function buildMidea(state: AcState, codeSet: AcCodeSet, brand: AcBrand): number[] {
  const bytes = mideaBytes(state, codeSet, brand);
  const pattern: number[] = [];
  for (const frame of [bytes, bytes.map((value) => ~value & 0xff)]) {
    pattern.push(MIDEA_HDR, MIDEA_HDR);
    for (const byte of frame) pushMsbByte(pattern, byte, MIDEA_BIT_MARK, MIDEA_ONE, MIDEA_ZERO);
    pattern.push(MIDEA_BIT_MARK, MIDEA_GAP);
  }
  pattern.push(NEC_GAP);
  return pattern;
}

function buildNec(brand: AcBrand, state: AcState, codeSet: AcCodeSet): number[] {
  const address = NEC_ADDRESSES[brand]?.[codeSet] ?? { low: 0x00, high: 0x00 };
  const temperatureByte =
    (clamp(state.temperature - AC_MIN_TEMPERATURE, 0, 14) & 0x0f) |
    ((NEC_FAN[state.fan] & 0x03) << 4);
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
  codeSet: AcCodeSet = 1,
  carrierFrequency = 38000,
): AcIrPattern {
  const profile = getAcBrandProfile(brand);
  let pattern: number[];
  if (profile.family === 'yap') pattern = buildYap(state, codeSet);
  else if (profile.family === 'midea') pattern = buildMidea(state, codeSet, brand);
  else pattern = buildNec(brand, state, codeSet);
  return { carrierFrequency, pattern };
}

export function getAcBrandProfile(brand: AcBrand): AcBrandProfile {
  return AC_BRANDS.find((profile) => profile.brand === brand) ?? AC_BRANDS[0];
}

export function createDefaultAcState(): AcState {
  return {
    power: false,
    temperature: 24,
    mode: 'Cool',
    fan: 'Auto',
    swing: false,
    turbo: false,
    sleep: false,
    eco: false,
    ledOff: false,
    sleepTimer: 0,
  };
}
