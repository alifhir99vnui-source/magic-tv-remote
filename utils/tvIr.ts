import { RealIrController } from './realIr';

export type TvBrand =
  | 'Magic'
  | 'Nikai'
  | 'LG'
  | 'Samsung'
  | 'Sony'
  | 'TCL'
  | 'Hisense'
  | 'Toshiba'
  | 'Panasonic'
  | 'Skyworth'
  | 'Xiaomi'
  | 'Philips'
  | 'Sharp'
  | 'StarSat'
  | 'Tiger'
  | 'AlHafidh'
  | 'Star-X'
  | 'Denka'
  | 'Generic';

export interface TvBrandProfile {
  brand: TvBrand;
  label: { ar: string; en: string };
  address: Record<1 | 2 | 3, { low: number; high: number }>;
  commands: Record<string, number>;
}

export const TV_BRANDS: TvBrand[] = [
  'Magic',
  'Nikai',
  'LG',
  'Samsung',
  'Sony',
  'TCL',
  'Hisense',
  'Toshiba',
  'Panasonic',
  'Skyworth',
  'Xiaomi',
  'Philips',
  'Sharp',
  'StarSat',
  'Tiger',
  'AlHafidh',
  'Star-X',
  'Denka',
  'Generic',
];

export const TV_CODE_SETS = [1, 2, 3] as const;

const BASE_COMMANDS: Record<string, number> = {
  power: 0x45,
  mute: 0x43,
  search: 0x48,
  voice: 0x48,
  mouse: 0x6d,
  up: 0x60,
  down: 0x61,
  left: 0x62,
  right: 0x63,
  ok: 0x65,
  back: 0x74,
  home: 0x77,
  menu: 0x4d,
  source: 0x54,
  settings: 0x4d,
  recents: 0x6d,
  volumeUp: 0x09,
  volumeDown: 0x08,
  channelUp: 0x18,
  channelDown: 0x19,
  playPause: 0x35,
  rewind: 0x36,
  forward: 0x37,
  stop: 0x38,
  info: 0x1c,
  subtitle: 0x39,
  audio: 0x3a,
  red: 0x26,
  green: 0x27,
  yellow: 0x28,
  blue: 0x29,
  num0: 0x00,
  num1: 0x01,
  num2: 0x02,
  num3: 0x03,
  num4: 0x04,
  num5: 0x05,
  num6: 0x06,
  num7: 0x07,
  num8: 0x08,
  num9: 0x09,
};

export const TV_BRAND_PROFILES: Record<TvBrand, TvBrandProfile> = {
  Magic: {
    brand: 'Magic',
    label: { ar: 'ماجيك', en: 'Magic' },
    address: { 1: { low: 0x00, high: 0xff }, 2: { low: 0x80, high: 0x7f }, 3: { low: 0x01, high: 0xfe } },
    commands: BASE_COMMANDS,
  },
  Nikai: {
    brand: 'Nikai',
    label: { ar: 'نيكاي', en: 'Nikai' },
    address: { 1: { low: 0x00, high: 0xff }, 2: { low: 0x20, high: 0xdf }, 3: { low: 0x40, high: 0xbf } },
    commands: BASE_COMMANDS,
  },
  LG: {
    brand: 'LG',
    label: { ar: 'إل جي', en: 'LG' },
    address: { 1: { low: 0x04, high: 0xfb }, 2: { low: 0x24, high: 0xdb }, 3: { low: 0x44, high: 0xbb } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x55, menu: 0x43, info: 0x4f },
  },
  Samsung: {
    brand: 'Samsung',
    label: { ar: 'سامسونج', en: 'Samsung' },
    address: { 1: { low: 0x07, high: 0x07 }, 2: { low: 0x0f, high: 0xf0 }, 3: { low: 0x1f, high: 0xe0 } },
    commands: { ...BASE_COMMANDS, power: 0x0b, source: 0x14, menu: 0x5c, info: 0x4b },
  },
  Sony: {
    brand: 'Sony',
    label: { ar: 'سوني', en: 'Sony' },
    address: { 1: { low: 0x00, high: 0x45 }, 2: { low: 0x10, high: 0x35 }, 3: { low: 0x30, high: 0x15 } },
    commands: { ...BASE_COMMANDS, power: 0x14, home: 0x2a, menu: 0x63, source: 0x18 },
  },
  TCL: {
    brand: 'TCL',
    label: { ar: 'تي سي إل', en: 'TCL' },
    address: { 1: { low: 0x00, high: 0x55 }, 2: { low: 0x10, high: 0x45 }, 3: { low: 0x30, high: 0x25 } },
    commands: { ...BASE_COMMANDS, power: 0x12, source: 0x51, menu: 0x4d },
  },
  Hisense: {
    brand: 'Hisense',
    label: { ar: 'هايسنس', en: 'Hisense' },
    address: { 1: { low: 0x00, high: 0xaa }, 2: { low: 0x10, high: 0x9a }, 3: { low: 0x30, high: 0x7a } },
    commands: { ...BASE_COMMANDS, power: 0x0c, source: 0x50, menu: 0x4d },
  },
  Toshiba: {
    brand: 'Toshiba',
    label: { ar: 'توشيبا', en: 'Toshiba' },
    address: { 1: { low: 0x00, high: 0x40 }, 2: { low: 0x10, high: 0xef }, 3: { low: 0x30, high: 0xcf } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  'AlHafidh': {
    brand: 'AlHafidh',
    label: { ar: 'الحافظ', en: 'Al-Hafidh' },
    address: { 1: { low: 0x00, high: 0x33 }, 2: { low: 0x10, high: 0x23 }, 3: { low: 0x30, high: 0x03 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  'Star-X': {
    brand: 'Star-X',
    label: { ar: 'ستار إكس', en: 'Star-X' },
    address: { 1: { low: 0x00, high: 0x66 }, 2: { low: 0x10, high: 0x56 }, 3: { low: 0x30, high: 0x36 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Denka: {
    brand: 'Denka',
    label: { ar: 'دنكا', en: 'Denka' },
    address: { 1: { low: 0x00, high: 0x77 }, 2: { low: 0x10, high: 0x67 }, 3: { low: 0x30, high: 0x47 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Panasonic: {
    brand: 'Panasonic',
    label: { ar: 'باناسونيك', en: 'Panasonic' },
    address: { 1: { low: 0x04, high: 0xfb }, 2: { low: 0x24, high: 0xdb }, 3: { low: 0x44, high: 0xbb } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x55, menu: 0x4d },
  },
  Skyworth: {
    brand: 'Skyworth',
    label: { ar: 'سكاي وورث', en: 'Skyworth' },
    address: { 1: { low: 0x00, high: 0x5a }, 2: { low: 0x10, high: 0x4a }, 3: { low: 0x30, high: 0x2a } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Xiaomi: {
    brand: 'Xiaomi',
    label: { ar: 'شاومي', en: 'Xiaomi' },
    address: { 1: { low: 0x00, high: 0xee }, 2: { low: 0x10, high: 0xde }, 3: { low: 0x30, high: 0xbe } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Philips: {
    brand: 'Philips',
    label: { ar: 'فيليبس', en: 'Philips' },
    address: { 1: { low: 0x00, high: 0x33 }, 2: { low: 0x10, high: 0x23 }, 3: { low: 0x30, high: 0x03 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Sharp: {
    brand: 'Sharp',
    label: { ar: 'شارب', en: 'Sharp' },
    address: { 1: { low: 0x00, high: 0x22 }, 2: { low: 0x10, high: 0x12 }, 3: { low: 0x30, high: 0x02 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  StarSat: {
    brand: 'StarSat',
    label: { ar: 'ستار سات', en: 'StarSat' },
    address: { 1: { low: 0x00, high: 0x88 }, 2: { low: 0x10, high: 0x78 }, 3: { low: 0x30, high: 0x58 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Tiger: {
    brand: 'Tiger',
    label: { ar: 'تايجر', en: 'Tiger' },
    address: { 1: { low: 0x00, high: 0x99 }, 2: { low: 0x10, high: 0x89 }, 3: { low: 0x30, high: 0x69 } },
    commands: { ...BASE_COMMANDS, power: 0x45, source: 0x54, menu: 0x4d },
  },
  Generic: {
    brand: 'Generic',
    label: { ar: 'عام / عالمي', en: 'Generic / Universal' },
    address: { 1: { low: 0x00, high: 0xff }, 2: { low: 0x20, high: 0xdf }, 3: { low: 0x40, high: 0xbf } },
    commands: BASE_COMMANDS,
  },
};

export function buildTvIrPattern(
  brand: TvBrand,
  codeSet: 1 | 2 | 3,
  key: string,
  carrierFrequency = 38000,
): { carrierFrequency: number; pattern: number[] } {
  const profile = TV_BRAND_PROFILES[brand] ?? TV_BRAND_PROFILES.Generic;
  const command = profile.commands[key] ?? profile.commands.select ?? profile.commands.ok ?? 0x00;
  const address = profile.address[codeSet] ?? profile.address[1];
  const frequency = carrierFrequency > 0 ? carrierFrequency : 38000;
  if (brand === 'Samsung') {
    return RealIrController.samsung32((address.low << 8) | address.high, command, frequency);
  }
  return RealIrController.nec(address.low, address.high, command, frequency);
}
