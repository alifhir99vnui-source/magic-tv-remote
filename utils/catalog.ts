export interface TvBoxProfile {
  id: string;
  name: string;
  brand: string;
  port: number;
  protocol: 'adb' | 'ws' | 'http';
  hints: string[];
}

export const TV_BOXES: TvBoxProfile[] = [
  { id: 'magic-a200-pro', name: 'Magic A200 Pro', brand: 'Magic', port: 5555, protocol: 'adb', hints: ['Android TV Remote', 'Bluetooth HID', 'IR Blaster'] },
  { id: 'xiaomi-mi-box', name: 'Xiaomi Mi Box / Stick', brand: 'Xiaomi', port: 5555, protocol: 'adb', hints: ['Android TV', 'Google TV'] },
  { id: 'tox3', name: 'TOX3', brand: 'TOX3', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 'h96-max', name: 'H96 Max', brand: 'H96', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 'x96-max', name: 'X96 Max / Mini', brand: 'X96', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 'tanix-tx3', name: 'Tanix TX3', brand: 'Tanix', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 'mxq-pro', name: 'MXQ Pro', brand: 'MXQ', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 't95', name: 'T95', brand: 'T95', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
  { id: 'beelink', name: 'Beelink', brand: 'Beelink', port: 5555, protocol: 'adb', hints: ['Mini PC', 'Android TV'] },
  { id: 'mecool', name: 'Mecool', brand: 'Mecool', port: 5555, protocol: 'adb', hints: ['Android TV Box'] },
];
