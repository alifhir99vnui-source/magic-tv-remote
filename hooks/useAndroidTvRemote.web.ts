import { useCallback, useState } from 'react';

export type RemoteKeyName =
  | 'KEYCODE_DPAD_UP'
  | 'KEYCODE_DPAD_DOWN'
  | 'KEYCODE_DPAD_LEFT'
  | 'KEYCODE_DPAD_RIGHT'
  | 'KEYCODE_DPAD_CENTER'
  | 'KEYCODE_BACK'
  | 'KEYCODE_HOME'
  | 'KEYCODE_MENU'
  | 'KEYCODE_VOLUME_UP'
  | 'KEYCODE_VOLUME_DOWN'
  | 'KEYCODE_CHANNEL_UP'
  | 'KEYCODE_CHANNEL_DOWN'
  | 'KEYCODE_MUTE';

export function useAndroidTvRemote() {
  const [error, setError] = useState('');

  const connect = useCallback(async () => {
    setError('هذه معاينة بالمتصفح؛ الاتصال يحتاج نسخة Android أصلية.');
    return false;
  }, []);

  const disconnect = useCallback(() => {
    setError('');
  }, []);

  const submitPairingCode = useCallback(async () => {
    setError('الاتصال الفعلي يحتاج نسخة Android أصلية.');
    return false;
  }, []);

  const sendKey = useCallback(() => {
    setError('الاتصال الفعلي يحتاج نسخة Android أصلية.');
    return false;
  }, []);

  const sendPower = useCallback(() => {
    setError('الاتصال الفعلي يحتاج نسخة Android أصلية.');
    return false;
  }, []);

  return {
    status: 'disconnected' as const,
    error,
    isConnected: false,
    connect,
    disconnect,
    submitPairingCode,
    sendKey,
    sendPower,
  };
}
