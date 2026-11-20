import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {
  AndroidRemote as NativeAndroidRemote,
  AndroidRemoteCertificate,
} from 'react-native-androidtv-remote';

type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'pairing'
  | 'connected'
  | 'error';

export type RemoteKeyName =
  | 'KEYCODE_POWER'
  | 'KEYCODE_SLEEP'
  | 'KEYCODE_WAKEUP'
  | 'KEYCODE_DPAD_UP'
  | 'KEYCODE_DPAD_DOWN'
  | 'KEYCODE_DPAD_LEFT'
  | 'KEYCODE_DPAD_RIGHT'
  | 'KEYCODE_DPAD_CENTER'
  | 'KEYCODE_BACK'
  | 'KEYCODE_HOME'
  | 'KEYCODE_MENU'
  | 'KEYCODE_APP_SWITCH'
  | 'KEYCODE_VOLUME_UP'
  | 'KEYCODE_VOLUME_DOWN'
  | 'KEYCODE_VOLUME_MUTE'
  | 'KEYCODE_CHANNEL_UP'
  | 'KEYCODE_CHANNEL_DOWN'
  | 'KEYCODE_MEDIA_PLAY_PAUSE'
  | 'KEYCODE_MEDIA_PLAY'
  | 'KEYCODE_MEDIA_PAUSE'
  | 'KEYCODE_MEDIA_STOP'
  | 'KEYCODE_MEDIA_NEXT'
  | 'KEYCODE_MEDIA_PREVIOUS'
  | 'KEYCODE_MEDIA_FAST_FORWARD'
  | 'KEYCODE_MEDIA_REWIND'
  | 'KEYCODE_ASSIST'
  | 'KEYCODE_VOICE_ASSIST'
  | 'KEYCODE_SEARCH'
  | 'KEYCODE_SETTINGS'
  | 'KEYCODE_INFO'
  | 'KEYCODE_GUIDE'
  | 'KEYCODE_0'
  | 'KEYCODE_1'
  | 'KEYCODE_2'
  | 'KEYCODE_3'
  | 'KEYCODE_4'
  | 'KEYCODE_5'
  | 'KEYCODE_6'
  | 'KEYCODE_7'
  | 'KEYCODE_8'
  | 'KEYCODE_9'
  | 'KEYCODE_ENTER'
  | 'KEYCODE_DEL'
  | 'KEYCODE_PROG_RED'
  | 'KEYCODE_PROG_GREEN'
  | 'KEYCODE_PROG_YELLOW'
  | 'KEYCODE_PROG_BLUE';

const CERTIFICATE_STORAGE_KEY = 'magic-tv-remote.android-tv-certificate.v1';
const KEYSTORE_NAME = 'AndroidKeyStore';
const LOCAL_NETWORK_PERMISSION = 'android.permission.ACCESS_LOCAL_NETWORK' as never;

function isPrivateIPv4(value: string) {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function friendlyConnectionError(error: unknown) {
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('cannot find module') ||
    normalized.includes('native module') ||
    normalized.includes('not available') ||
    normalized.includes('undefined is not an object')
  ) {
    return 'الاتصال يحتاج نسخة Android أصلية؛ معاينة Replit وExpo Go ما تكفي.';
  }
  if (normalized.includes('local-network-denied')) {
    return 'لازم تسمح للتطبيق بالوصول إلى أجهزة الشبكة المحلية.';
  }
  if (normalized.includes('bad code') || normalized.includes('code validation')) {
    return 'رمز الاقتران غير صحيح. أعد المحاولة بالرمز الظاهر على التلفزيون.';
  }
  if (
    normalized.includes('econnrefused') ||
    normalized.includes('timeout') ||
    normalized.includes('network')
  ) {
    return 'ما وصلنا للصندوق. تأكد من عنوان IP وأن الجهازين على نفس شبكة Wi‑Fi.';
  }
  return 'تعذر الاتصال. تأكد من عنوان IP وأن Magic 200 Pro يدعم Android TV Remote.';
}

export function useAndroidTvRemote() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState('');
  const remoteRef = useRef<InstanceType<typeof NativeAndroidRemote> | null>(null);
  const keyCodesRef = useRef<Record<string, number> | null>(null);
  const directionsRef = useRef<Record<string, number> | null>(null);
  const statusRef = useRef<ConnectionStatus>('disconnected');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const updateStatus = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    if (mountedRef.current) {
      setStatus(next);
    }
  }, []);

  const clearConnectionTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopRemote = useCallback(() => {
    clearConnectionTimer();
    const remote = remoteRef.current;
    remoteRef.current = null;
    if (remote) {
      try {
        if (statusRef.current === 'pairing') {
          remote.cancelPairing();
        }
        remote.stop();
      } catch {
        // A failed or already-closed socket needs no further cleanup.
      }
    }
  }, [clearConnectionTimer]);

  const disconnect = useCallback(() => {
    stopRemote();
    setError('');
    updateStatus('disconnected');
  }, [stopRemote, updateStatus]);

  const connect = useCallback(
    async (host: string) => {
      const normalizedHost = host.trim();
      if (!isPrivateIPv4(normalizedHost)) {
        setError('اكتب عنوان IP محلي صحيح للصندوق، مثل 192.168.1.20.');
        updateStatus('error');
        return false;
      }
      if (Platform.OS !== 'android') {
        setError('الاتصال الفعلي يحتاج نسخة Android أصلية، مو معاينة المتصفح.');
        updateStatus('error');
        return false;
      }

      stopRemote();
      setError('');
      updateStatus('connecting');

      try {
        if (Number(Platform.Version) >= 37) {
          const permission = await PermissionsAndroid.request(
            LOCAL_NETWORK_PERMISSION,
            {
              title: 'السماح بالاتصال بالشبكة المحلية',
              message: 'يحتاج التطبيق هذا الإذن حتى يتصل بـ Magic 200 Pro على شبكة البيت.',
              buttonPositive: 'سماح',
              buttonNegative: 'رفض',
            },
          );
          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            throw new Error('local-network-denied');
          }
        }

        const { AndroidRemote, RemoteDirection, RemoteKeyCode } =
          await import('react-native-androidtv-remote');
        keyCodesRef.current = RemoteKeyCode;
        directionsRef.current = RemoteDirection;

        const savedCertificate = await SecureStore.getItemAsync(
          CERTIFICATE_STORAGE_KEY,
        );
        let certificate: AndroidRemoteCertificate | undefined;
        if (savedCertificate) {
          try {
            certificate = JSON.parse(savedCertificate) as AndroidRemoteCertificate;
          } catch {
            await SecureStore.deleteItemAsync(CERTIFICATE_STORAGE_KEY);
          }
        }

        const sessionSuffix =
          certificate?.keyAlias?.replace(/^magic-tv-key-/, '') ??
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const certAlias =
          certificate?.certAlias ?? `magic-tv-cert-${sessionSuffix}`;
        const keyAlias =
          certificate?.keyAlias ?? `magic-tv-key-${sessionSuffix}`;
        const remote = new AndroidRemote(normalizedHost, {
          pairing_port: 6467,
          remote_port: 6466,
          service_name: 'com.magicremote.androidtv',
          systeminfo: {
            manufacturer: 'Magic Remote',
            model: 'Magic 200 Pro Remote',
          },
          cert: certificate ?? {
            key: null,
            cert: null,
            androidKeyStore: KEYSTORE_NAME,
            certAlias,
            keyAlias,
          },
        });
        remoteRef.current = remote;

        remote.on('secret', () => {
          if (remoteRef.current !== remote) return;
          clearConnectionTimer();
          updateStatus('pairing');
          setError('');
          timeoutRef.current = setTimeout(() => {
            if (remoteRef.current !== remote) return;
            stopRemote();
            updateStatus('error');
            setError('انتهت مهلة الاقتران. اتصل من جديد وأدخل الرمز بسرعة.');
          }, 120_000);
        });

        remote.on('ready', async () => {
          if (remoteRef.current !== remote) return;
          clearConnectionTimer();
          updateStatus('connected');
          setError('');
          try {
            await SecureStore.setItemAsync(
              CERTIFICATE_STORAGE_KEY,
              JSON.stringify({
                ...remote.getCertificate(),
                androidKeyStore: KEYSTORE_NAME,
                certAlias,
                keyAlias,
              }),
            );
          } catch {
            if (mountedRef.current) {
              setError('اتصل الجهاز، لكن تعذر حفظ الاقتران. قد تحتاج تعيد الاقتران لاحقاً.');
            }
          }
        });

        remote.on('unpaired', async () => {
          if (remoteRef.current !== remote) return;
          stopRemote();
          await SecureStore.deleteItemAsync(CERTIFICATE_STORAGE_KEY).catch(() => {});
          updateStatus('error');
          setError('انلغى الاقتران من التلفزيون. اتصل من جديد لإعادة الاقتران.');
        });

        timeoutRef.current = setTimeout(() => {
          if (remoteRef.current !== remote || statusRef.current !== 'connecting') {
            return;
          }
          stopRemote();
          updateStatus('error');
          setError(friendlyConnectionError(new Error('connection timeout')));
        }, 20_000);

        void remote.start().catch((reason: unknown) => {
          if (remoteRef.current !== remote) return;
          stopRemote();
          updateStatus('error');
          setError(friendlyConnectionError(reason));
        });

        return true;
      } catch (reason) {
        stopRemote();
        updateStatus('error');
        setError(friendlyConnectionError(reason));
        return false;
      }
    },
    [clearConnectionTimer, stopRemote, updateStatus],
  );

  const submitPairingCode = useCallback(
    async (value: string) => {
      const code = value.trim().toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(code)) {
        setError('الرمز لازم يكون 6 خانات من الأرقام أو الأحرف A إلى F.');
        return false;
      }

      const remote = remoteRef.current;
      if (!remote || statusRef.current !== 'pairing') {
        setError('ابدأ الاتصال أولاً وانتظر ظهور طلب الاقتران.');
        return false;
      }

      try {
        const accepted = await remote.sendPairingCode(code);
        if (accepted === false) {
          setError('الرمز ما انقبل. تأكد من الرمز الظاهر على التلفزيون.');
          return false;
        }
        clearConnectionTimer();
        updateStatus('connecting');
        setError('تم إرسال الرمز؛ نكمل الاتصال...');
        return true;
      } catch (reason) {
        setError(friendlyConnectionError(reason));
        return false;
      }
    },
    [clearConnectionTimer, updateStatus],
  );

  const sendKey = useCallback(
    (keyName: RemoteKeyName) => {
      const remote = remoteRef.current;
      if (!remote || statusRef.current !== 'connected') {
        setError('اتصل بالصندوق أولاً حتى ترسل الأوامر.');
        return false;
      }
      const key = keyCodesRef.current?.[keyName];
      const direction = directionsRef.current?.SHORT;
      if (typeof key !== 'number' || typeof direction !== 'number') {
        setError('هذا الزر غير متاح بهذا البروتوكول.');
        return false;
      }
      try {
        remote.sendKey(key, direction);
        return true;
      } catch {
        setError('انقطع الاتصال أثناء إرسال الأمر. أعد الاتصال بالصندوق.');
        return false;
      }
    },
    [],
  );

  const sendPower = useCallback(() => {
    const remote = remoteRef.current;
    if (!remote || statusRef.current !== 'connected') {
      setError('اتصل بالصندوق أولاً حتى ترسل الأوامر.');
      return false;
    }
    try {
      remote.sendPower();
      return true;
    } catch {
      setError('انقطع الاتصال أثناء إرسال الأمر. أعد الاتصال بالصندوق.');
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRemote();
    };
  }, [stopRemote]);

  return {
    status,
    error,
    isConnected: status === 'connected',
    connect,
    disconnect,
    submitPairingCode,
    sendKey,
    sendPower,
  };
}
