declare module 'react-native-androidtv-remote' {
  export type AndroidRemoteCertificate = {
    key: string | null;
    cert: string | null;
    androidKeyStore?: string;
    certAlias?: string;
    keyAlias?: string;
  };

  export type AndroidRemoteOptions = {
    pairing_port?: number;
    remote_port?: number;
    service_name?: string;
    systeminfo?: {
      manufacturer?: string;
      model?: string;
    };
    cert?: AndroidRemoteCertificate;
  };

  export class AndroidRemote {
    constructor(host: string, options: AndroidRemoteOptions);
    on(event: string, listener: (...args: unknown[]) => void): this;
    start(): Promise<unknown>;
    sendPairingCode(code: string): Promise<boolean | undefined>;
    cancelPairing(): unknown;
    sendPower(): unknown;
    sendKey(key: number, direction: number): unknown;
    getCertificate(): { key: string; cert: string };
    stop(): void;
  }

  export const RemoteKeyCode: Record<string, number>;
  export const RemoteDirection: Record<string, number>;
}
