export type DeviceProtocol = 'adb' | 'ws' | 'http';
export type DeviceTransport = 'wifi' | 'bluetooth';

export interface SavedDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  protocol: DeviceProtocol;
  transport?: DeviceTransport;
  bluetoothMac?: string;
  lastSeen?: string;
  model?: string;
  source?: string;
}
