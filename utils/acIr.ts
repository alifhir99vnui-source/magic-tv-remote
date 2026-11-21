import { RealIrController } from './realIr';

export type AcBrand =
  | 'Tosot'
  | 'Gree'
  | 'AlHafidh'
  | 'Midea'
  | 'LG'
  | 'Samsung'
  | 'General'
  | 'OGeneral'
  | 'Sharp'
  | 'Panasonic'
  | 'Carrier'
  | 'York'
  | 'Hisense'
  | 'Craft'
  | 'WhiteWestinghouse';

export type AcCodeSet = 1 | 2 | 3;
export type AcMode = 'Auto' | 'Cool' | 'Heat' | 'Dry' | 'Fan';
export type AcFan = 'Auto' | 'Low' | 'Medium' | 'High';
export type AcProtocolFamily = 'yap' | 'midea' | 'nec' | 'lgac' | 'kaseikyo';

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
    protocol: 'YAC1FB1 38kHz',
    family: 'yap',
    detail: { ar: 'بروتوكول Gree/YAP بإطار 8 بايت والمجموع التحققي', en: 'Gree/YAP 8-byte frame with checksum' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Gree',
    label: { ar: 'جري', en: 'Gree' },
    protocol: 'YAC1FB1 38kHz',
    family: 'yap',
    detail: { ar: 'بروتوكول YAC1FB1 المستخدم في أجهزة جري', en: 'YAC1FB1 protocol used by Gree units' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'AlHafidh',
    label: { ar: 'الحافظ', en: 'Al-Hafidh' },
    protocol: 'YAC1FB1 38kHz',
    family: 'yap',
    detail: { ar: 'بروتوكول YAC1FB1 مع مجموع تحققي للبايتات 0 إلى 7', en: 'YAC1FB1 with checksum over bytes 0 to 7' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Midea',
    label: { ar: 'ميديا', en: 'Midea' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'إطار 48 بت مع الإطار المعكوس والمجموع التحققي', en: '48-bit frame with inverted frame and checksum' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'LG',
    label: { ar: 'إل جي', en: 'LG' },
    protocol: 'LG AC 28-bit 38kHz',
    family: 'lgac',
    detail: { ar: 'بروتوكول LG AC بصيغة 28 بت', en: 'LG AC 28-bit protocol' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Samsung',
    label: { ar: 'سامسونج', en: 'Samsung' },
    protocol: 'NEC 32-bit 38kHz',
    family: 'nec',
    detail: { ar: 'أكواد سامسونج بصيغة NEC 32 بت', en: 'Samsung 32-bit NEC-compatible codes' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'General',
    label: { ar: 'جنرال', en: 'General' },
    protocol: 'YAC1FB1 38kHz',
    family: 'yap',
    detail: { ar: 'بروتوكول YAC1FB1 مع أكواد General', en: 'YAC1FB1 with General code sets' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'OGeneral',
    label: { ar: 'أو جنرال', en: 'O General' },
    protocol: 'YAC1FB1 38kHz',
    family: 'yap',
    detail: { ar: 'بروتوكول YAC1FB1 مع أكواد O General', en: 'YAC1FB1 with O General code sets' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Sharp',
    label: { ar: 'شارب', en: 'Sharp' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'متوافق مع منصة Midea للتحكم بالسبلت', en: 'Midea-compatible AC control platform' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Panasonic',
    label: { ar: 'باناسونيك', en: 'Panasonic' },
    protocol: 'Kaseikyo 37kHz',
    family: 'kaseikyo',
    detail: { ar: 'بروتوكول Kaseikyo لبناسونيك', en: 'Panasonic Kaseikyo protocol' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Carrier',
    label: { ar: 'كارير', en: 'Carrier' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'متوافق مع بروتوكول Midea المستخدم في كارير', en: 'Midea-compatible protocol used by Carrier' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'York',
    label: { ar: 'يورك', en: 'York' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'متوافق مع بروتوكول Midea المستخدم في يورك', en: 'Midea-compatible protocol used by York' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Hisense',
    label: { ar: 'هايسنس', en: 'Hisense' },
    protocol: 'NEC 32-bit 38kHz',
    family: 'nec',
    detail: { ar: 'أكواد NEC 32 بت المتوافقة مع هايسنس', en: 'NEC 32-bit codes compatible with Hisense' },
    minTemperature: AC_MIN_TEMPERATURE,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'Craft',
    label: { ar: 'كرافت', en: 'Craft' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'متوافق مع بروتوكول Midea المستخدم في كرافت', en: 'Midea-compatible protocol used by Craft' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
  {
    brand: 'WhiteWestinghouse',
    label: { ar: 'وايت وستنجهاوس', en: 'White-Westinghouse' },
    protocol: 'Midea 48-bit 38kHz',
    family: 'midea',
    detail: { ar: 'متوافق مع بروتوكول Midea المستخدم في وايت وستنجهاوس', en: 'Midea-compatible protocol used by White-Westinghouse' },
    minTemperature: 17,
    maxTemperature: AC_MAX_TEMPERATURE,
  },
];

export const AC_MODES: AcMode[] = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
export const AC_FANS: AcFan[] = ['Auto', 'Low', 'Medium', 'High'];
export const AC_CODE_SETS: AcCodeSet[] = [1, 2, 3];

export function buildAcIrPattern(
  brand: AcBrand,
  state: AcState,
  codeSet: AcCodeSet = 1,
  carrierFrequency = 38000,
): AcIrPattern {
  const profile = getAcBrandProfile(brand);
  return RealIrController.ac(brand, profile.family, state, codeSet, carrierFrequency);
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
