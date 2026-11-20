import * as Network from 'expo-network';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  FlatList,
  Keyboard,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  RemoteAppShortcut,
  RemoteExperience,
  RemoteMouseController,
} from '../components/RemoteExperience';
import { AcPanel } from '../components/AcPanel';
import {
  AcBrand,
  AcState,
  buildAcIrPattern,
} from '../utils/acIr';
import {
  RemoteKeyName,
  useAndroidTvRemote,
} from '../hooks/useAndroidTvRemote';

const STORAGE_KEY = '@magic_tv_remote_state_v2';
const LEGACY_STORAGE_KEY = '@magic_tv_remote_state_v1';

interface SavedDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  protocol: 'adb' | 'ws' | 'http';
  transport?: 'wifi' | 'bluetooth';
  bluetoothMac?: string;
  lastSeen?: string;
  model?: string;
}

interface QuickCommand {
  id: string;
  label: string;
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface RemoteAppState {
  devices: SavedDevice[];
  activeDeviceId: string | null;
  hapticsEnabled: boolean;
  mouseSensitivity: number;
  autoConnect: boolean;
  quickCommands: QuickCommand[];
  customApps: RemoteAppShortcut[];
}

const DEFAULT_APPS: RemoteAppShortcut[] = [
  { id: '1', name: 'YouTube', packageName: 'com.google.android.youtube.tv', icon: 'logo-youtube' },
  { id: '2', name: 'Netflix', packageName: 'com.netflix.ninja', icon: 'tv-outline' },
  { id: '3', name: 'Prime Video', packageName: 'com.amazon.amazonvideo.livingroom', icon: 'play-circle-outline' },
  { id: '4', name: 'Shahid', packageName: 'net.mbc.shahid', icon: 'film-outline' },
  { id: '5', name: 'Kodi', packageName: 'org.xbmc.kodi', icon: 'grid-outline' },
  { id: '6', name: 'Plex', packageName: 'com.plexapp.android', icon: 'folder-open-outline' },
  { id: '7', name: 'Files / APK', packageName: 'com.android.tv.settings', icon: 'settings-outline' },
  { id: '8', name: 'Browser', packageName: 'com.android.browser', icon: 'globe-outline' },
];

const DEFAULT_QUICK_COMMANDS: QuickCommand[] = [
  { id: 'q1', label: 'إيقاف مؤقت / تشغيل', action: 'playPause', icon: 'play-skip-forward-outline' },
  { id: 'q2', label: 'كتم الصوت', action: 'mute', icon: 'volume-mute-outline' },
  { id: 'q3', label: 'قائمة التطبيقات', action: 'recents', icon: 'apps-outline' },
  { id: 'q4', label: 'إغلاق الشاشة', action: 'sleep', icon: 'moon-outline' },
];

const INITIAL_STATE: RemoteAppState = {
  devices: [],
  activeDeviceId: null,
  hapticsEnabled: true,
  mouseSensitivity: 1.35,
  autoConnect: true,
  quickCommands: DEFAULT_QUICK_COMMANDS,
  customApps: DEFAULT_APPS,
};

interface MagicHardwareBridge {
  isPointerSupported?: () => Promise<boolean>;
  isAirMouseSupported?: () => Promise<boolean>;
  sendMouseMove?: (dx: number, dy: number) => Promise<boolean>;
  sendMouseClick?: (button: 'left' | 'right') => Promise<boolean>;
  sendMouseScroll?: (deltaY: number) => Promise<boolean>;
  recenterPointer?: () => Promise<boolean>;
  scanBluetoothDevices?: () => Promise<
    Array<{ name?: string; address?: string; bondState?: string }>
  >;
  pairOrConnectBluetoothHid?: (address: string) => Promise<boolean>;
  sendBluetoothHidKey?: (key: string) => Promise<boolean>;
  sendIrKey?: (key: string) => Promise<boolean>;
  transmitIr?: (carrierFrequency: number, pattern: number[]) => Promise<boolean>;
  launchTvApp?: (packageName: string) => Promise<boolean>;
  hasIrEmitter?: () => Promise<boolean>;
}

const MagicHardware: MagicHardwareBridge | undefined =
  (NativeModules as { MagicControl?: MagicHardwareBridge }).MagicControl;

const KEYCODE_MAP: Record<string, { androidKeyCode: number; label: string }> = {
  power: { androidKeyCode: 26, label: 'POWER' },
  sleep: { androidKeyCode: 223, label: 'SLEEP' },
  wakeup: { androidKeyCode: 224, label: 'WAKEUP' },
  up: { androidKeyCode: 19, label: 'DPAD_UP' },
  down: { androidKeyCode: 20, label: 'DPAD_DOWN' },
  left: { androidKeyCode: 21, label: 'DPAD_LEFT' },
  right: { androidKeyCode: 22, label: 'DPAD_RIGHT' },
  ok: { androidKeyCode: 23, label: 'DPAD_CENTER' },
  select: { androidKeyCode: 23, label: 'DPAD_CENTER' },
  back: { androidKeyCode: 4, label: 'BACK' },
  home: { androidKeyCode: 3, label: 'HOME' },
  menu: { androidKeyCode: 82, label: 'MENU' },
  recents: { androidKeyCode: 187, label: 'APP_SWITCH' },
  volumeUp: { androidKeyCode: 24, label: 'VOLUME_UP' },
  volumeDown: { androidKeyCode: 25, label: 'VOLUME_DOWN' },
  mute: { androidKeyCode: 164, label: 'VOLUME_MUTE' },
  channelUp: { androidKeyCode: 166, label: 'CHANNEL_UP' },
  channelDown: { androidKeyCode: 167, label: 'CHANNEL_DOWN' },
  playPause: { androidKeyCode: 85, label: 'MEDIA_PLAY_PAUSE' },
  play: { androidKeyCode: 126, label: 'MEDIA_PLAY' },
  pause: { androidKeyCode: 127, label: 'MEDIA_PAUSE' },
  stop: { androidKeyCode: 86, label: 'MEDIA_STOP' },
  next: { androidKeyCode: 87, label: 'MEDIA_NEXT' },
  prev: { androidKeyCode: 88, label: 'MEDIA_PREVIOUS' },
  fastForward: { androidKeyCode: 90, label: 'MEDIA_FAST_FORWARD' },
  rewind: { androidKeyCode: 89, label: 'MEDIA_REWIND' },
  voice: { androidKeyCode: 219, label: 'VOICE_ASSIST' },
  search: { androidKeyCode: 84, label: 'SEARCH' },
  settings: { androidKeyCode: 176, label: 'SETTINGS' },
  info: { androidKeyCode: 165, label: 'INFO' },
  guide: { androidKeyCode: 172, label: 'GUIDE' },
  num0: { androidKeyCode: 7, label: '0' },
  num1: { androidKeyCode: 8, label: '1' },
  num2: { androidKeyCode: 9, label: '2' },
  num3: { androidKeyCode: 10, label: '3' },
  num4: { androidKeyCode: 11, label: '4' },
  num5: { androidKeyCode: 12, label: '5' },
  num6: { androidKeyCode: 13, label: '6' },
  num7: { androidKeyCode: 14, label: '7' },
  num8: { androidKeyCode: 15, label: '8' },
  num9: { androidKeyCode: 16, label: '9' },
  enter: { androidKeyCode: 66, label: 'ENTER' },
  del: { androidKeyCode: 67, label: 'DEL' },
  red: { androidKeyCode: 183, label: 'PROG_RED' },
  green: { androidKeyCode: 184, label: 'PROG_GREEN' },
  yellow: { androidKeyCode: 185, label: 'PROG_YELLOW' },
  blue: { androidKeyCode: 186, label: 'PROG_BLUE' },
};

const ANDROID_TV_KEY_MAP: Record<string, RemoteKeyName> = {
  power: 'KEYCODE_POWER',
  mute: 'KEYCODE_VOLUME_MUTE',
  info: 'KEYCODE_INFO',
  up: 'KEYCODE_DPAD_UP',
  down: 'KEYCODE_DPAD_DOWN',
  left: 'KEYCODE_DPAD_LEFT',
  right: 'KEYCODE_DPAD_RIGHT',
  ok: 'KEYCODE_DPAD_CENTER',
  select: 'KEYCODE_DPAD_CENTER',
  enter: 'KEYCODE_ENTER',
  back: 'KEYCODE_BACK',
  del: 'KEYCODE_DEL',
  home: 'KEYCODE_HOME',
  menu: 'KEYCODE_MENU',
  recents: 'KEYCODE_APP_SWITCH',
  volumeUp: 'KEYCODE_VOLUME_UP',
  volumeDown: 'KEYCODE_VOLUME_DOWN',
  channelUp: 'KEYCODE_CHANNEL_UP',
  channelDown: 'KEYCODE_CHANNEL_DOWN',
  playPause: 'KEYCODE_MEDIA_PLAY_PAUSE',
  play: 'KEYCODE_MEDIA_PLAY',
  pause: 'KEYCODE_MEDIA_PAUSE',
  stop: 'KEYCODE_MEDIA_STOP',
  next: 'KEYCODE_MEDIA_NEXT',
  prev: 'KEYCODE_MEDIA_PREVIOUS',
  fastForward: 'KEYCODE_MEDIA_FAST_FORWARD',
  rewind: 'KEYCODE_MEDIA_REWIND',
  voice: 'KEYCODE_VOICE_ASSIST',
  search: 'KEYCODE_SEARCH',
  settings: 'KEYCODE_SETTINGS',
  guide: 'KEYCODE_GUIDE',
  red: 'KEYCODE_PROG_RED',
  green: 'KEYCODE_PROG_GREEN',
  yellow: 'KEYCODE_PROG_YELLOW',
  blue: 'KEYCODE_PROG_BLUE',
  num0: 'KEYCODE_0',
  num1: 'KEYCODE_1',
  num2: 'KEYCODE_2',
  num3: 'KEYCODE_3',
  num4: 'KEYCODE_4',
  num5: 'KEYCODE_5',
  num6: 'KEYCODE_6',
  num7: 'KEYCODE_7',
  num8: 'KEYCODE_8',
  num9: 'KEYCODE_9',
};

function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function getSubnetPrefix(ip: string | null | undefined): string | null {
  if (!ip || !isValidIpv4(ip)) return null;
  const parts = ip.trim().split('.');
  if (parts[0] === '127' || parts[0] === '0' || parts[0] === '169') return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

async function probeTvHost(
  ip: string,
  port: number,
  protocol: 'adb' | 'ws' | 'http',
  timeoutMs = 650,
): Promise<{ reachable: boolean; name?: string; model?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const portsToCheck = Array.from(
    new Set([port, 5555, 6467, 6466, 8090, 8008, 7676, 80]),
  );

  try {
    for (const candidatePort of portsToCheck) {
      const url = `http://${ip}:${candidatePort}/`;
      try {
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
        });
        const text = await res.text().catch(() => '');
        const isMagic =
          /magic|a200|android|tv|leanback|bravia|roku|chromecast|adb/i.test(text);
        if (res.status > 0 || isMagic) {
          clearTimeout(timer);
          return {
            reachable: true,
            name: isMagic ? 'Magic A200 Pro TV' : `جهاز شبكة (${ip})`,
            model:
              candidatePort === 5555
                ? `ADB:${candidatePort} (${protocol.toUpperCase()})`
                : `Port ${candidatePort}`,
          };
        }
      } catch {
        // Continue checking candidate ports
      }
    }
  } finally {
    clearTimeout(timer);
  }

  return { reachable: false };
}

async function sendCommandToTv(
  device: SavedDevice,
  payload: Record<string, unknown>,
  timeoutMs = 1500,
): Promise<{ ok: boolean; detail: string }> {
  if (device.transport === 'bluetooth' && MagicHardware?.sendBluetoothHidKey) {
    try {
      const sent = await MagicHardware.sendBluetoothHidKey(String(payload.key ?? ''));
      if (sent) {
        return { ok: true, detail: `Bluetooth HID (${device.name})` };
      }
    } catch {
      // Fallback to network attempt
    }
  }

  if (MagicHardware?.sendIrKey && payload.type === 'key') {
    try {
      const irSent = await MagicHardware.sendIrKey(String(payload.key ?? ''));
      if (irSent) {
        return { ok: true, detail: `IR Emitter (${device.name})` };
      }
    } catch {
      // Fallback to network attempt
    }
  }

  const endpoints = [
    `http://${device.ip}:${device.port}/remote/command`,
    `http://${device.ip}:${device.port}/api/command`,
    `http://${device.ip}:8090/remote/command`,
    `http://${device.ip}:5555/command`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Remote-Client': 'MagicTVRemote/2.0',
        },
        body: JSON.stringify({
          ...payload,
          protocol: device.protocol,
          timestamp: Date.now(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok || response.status === 204) {
        return { ok: true, detail: `${device.ip}:${device.port}` };
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    detail: `تعذر الوصول إلى ${device.ip}:${device.port}`,
  };
}
export default function MagicTvRemoteScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const tvRemote = useAndroidTvRemote();

  const colors = useMemo(
    () =>
      isDark
        ? {
            background: '#080C0E',
            card: '#11181C',
            cardAlt: '#172127',
            border: '#223038',
            text: '#F2F7F9',
            secondary: '#8FA2AC',
            input: '#0D1316',
          }
        : {
            background: '#F3F6F8',
            card: '#FFFFFF',
            cardAlt: '#E9EFF3',
            border: '#D4DFE6',
            text: '#0F171A',
            secondary: '#5B6D77',
            input: '#F7FAFC',
          },
    [isDark],
  );

  const [state, setState] = useState<RemoteAppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  const [screen, setScreen] = useState<'remote' | 'ac'>('remote');
  const [activeTab, setActiveTab] = useState<'remote' | 'mouse'>('remote');
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [lastFeedback, setLastFeedback] = useState<string>('جاهز للاتصال بـ Magic A200 Pro');
  const [lastActionBadge, setLastActionBadge] = useState<string | null>(null);

  const [pointerSupported, setPointerSupported] = useState(false);
  const [pointerStatus, setPointerStatus] = useState('لوحة اللمس جاهزة');

  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [addAppModalVisible, setAddAppModalVisible] = useState(false);
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [pairingModalVisible, setPairingModalVisible] = useState(false);
  const [pairingCode, setPairingCode] = useState('');

  const [manualName, setManualName] = useState('Magic A200 Pro');
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('5555');
  const [manualProtocol, setManualProtocol] = useState<'adb' | 'ws' | 'http'>('adb');
  const [manualTransport, setManualTransport] = useState<'wifi' | 'bluetooth'>('wifi');
  const [manualBtMac, setManualBtMac] = useState('');

  const [scanning, setScanning] = useState(false);
  const [scanProgressText, setScanProgressText] = useState('');
  const [discoveredDevices, setDiscoveredDevices] = useState<SavedDevice[]>([]);
  const [btDevices, setBtDevices] = useState<
    Array<{ name: string; address: string; bondState?: string }>
  >([]);
  const [btScanning, setBtScanning] = useState(false);

  const [tvTextInput, setTvTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);

  const [newAppName, setNewAppName] = useState('');
  const [newAppPackage, setNewAppPackage] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState('');
  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(''), 2500);
  }, []);
  const activeDevice = useMemo(
    () => state.devices.find((d) => d.id === state.activeDeviceId) ?? null,
    [state.devices, state.activeDeviceId],
  );
  const requestBluetoothPermissions = useCallback(async () => {
    if (Platform.OS !== 'android') return false;
    if (Number(Platform.Version) < 31) return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }, []);

  const connectToDevice = useCallback(
    async (dev: SavedDevice) => {
      setState((prev) => ({ ...prev, activeDeviceId: dev.id }));
      setPairingCode('');

      if (dev.transport === 'bluetooth') {
        const allowed = await requestBluetoothPermissions();
        if (!allowed) {
          setConnectionStatus('disconnected');
          showFeedback('صلاحيات البلوتوث مطلوبة لربط الريموت');
          return;
        }
        if (dev.bluetoothMac && MagicHardware?.pairOrConnectBluetoothHid) {
          setConnectionStatus('connecting');
          try {
            const paired = await MagicHardware.pairOrConnectBluetoothHid(
              dev.bluetoothMac,
            );
            setConnectionStatus(paired ? 'connected' : 'disconnected');
            showFeedback(paired ? `متصل بـ ${dev.name}` : 'تعذر ربط جهاز Bluetooth HID');
          } catch {
            setConnectionStatus('disconnected');
            showFeedback('تعذر ربط جهاز Bluetooth HID');
          }
        } else {
          setConnectionStatus('disconnected');
          showFeedback('اقتران Bluetooth HID غير متاح في هذا البناء');
        }
        return;
      }

      setConnectionStatus('connecting');
      const ok = await tvRemote.connect(dev.ip);
      setConnectionStatus(ok ? 'connecting' : 'disconnected');
      showFeedback(
        ok ? 'جاري الاتصال... انتظر رمز الاقتران إن ظهر' : tvRemote.error,
      );
    },
    [requestBluetoothPermissions, showFeedback, tvRemote],
  );

  const handleSendKey = useCallback(
    (key: string) => {
      if (activeDevice?.transport === 'wifi' && tvRemote.isConnected) {
        const keyName = ANDROID_TV_KEY_MAP[key];
        if (key === 'power') {
          tvRemote.sendPower();
        } else if (keyName) {
          tvRemote.sendKey(keyName);
        }
        return;
      }
      if (activeDevice) {
        sendCommandToTv(activeDevice, { type: 'key', key }, 200).catch(() => {});
      }
    },
    [activeDevice, tvRemote],
  );

  const handleLaunchApp = useCallback(
    async (pkg: string) => {
      if (MagicHardware?.launchTvApp) {
        try {
          const launched = await MagicHardware.launchTvApp(pkg);
          if (launched) {
            showFeedback(`تم فتح ${pkg}`);
            return;
          }
        } catch {
          // Fall back to the network protocol.
        }
      }
      if (activeDevice) {
        await sendCommandToTv(
          activeDevice,
          { type: 'launch_app', packageName: pkg },
          300,
        ).catch(() => {});
      }
    },
    [activeDevice, showFeedback],
  );

  const handleSendAcIr = useCallback(
    async (brand: AcBrand, acState: AcState) => {
      if (!MagicHardware?.transmitIr) {
        showFeedback('مُرسِل IR غير متاح في هذا البناء');
        return;
      }
      const { carrierFrequency, pattern } = buildAcIrPattern(brand, acState);
      try {
        const sent = await MagicHardware.transmitIr(carrierFrequency, pattern);
        showFeedback(
          sent
            ? `تم إرسال إعدادات ${brand} عبر IR`
            : 'تعذر إرسال أمر IR — تحقق من مُرسِل IR',
        );
      } catch {
        showFeedback('تعذر إرسال أمر IR — تحقق من مُرسِل IR');
      }
    },
    [showFeedback],
  );

  const handleSendTvText = useCallback(() => {
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'text' }, 300).catch(() => {});
    }
  }, [activeDevice]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pointer = await MagicHardware?.isPointerSupported?.().catch(
        () => false,
      );
      if (mounted) setPointerSupported(Boolean(pointer));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeDevice?.transport !== 'wifi') return;
    if (tvRemote.status === 'connected') {
      setConnectionStatus('connected');
      if (pairingModalVisible) setPairingModalVisible(false);
    } else if (tvRemote.status === 'pairing') {
      setConnectionStatus('connecting');
      setPairingModalVisible(true);
    } else if (tvRemote.status === 'connecting') {
      setConnectionStatus('connecting');
    } else {
      setConnectionStatus('disconnected');
    }
    if (tvRemote.error) setLastFeedback(tvRemote.error);
  }, [
    activeDevice?.transport,
    tvRemote.status,
    tvRemote.error,
    pairingModalVisible,
  ]);

  const handleTouchpadDelta = useCallback(
    (dx: number, dy: number) => {
      const scaledX = Math.round(dx * state.mouseSensitivity);
      const scaledY = Math.round(dy * state.mouseSensitivity);
      setPointerStatus(`Pointer (${scaledX}, ${scaledY})`);
      if (MagicHardware?.sendMouseMove) {
        MagicHardware.sendMouseMove(scaledX, scaledY).catch(() => {});
      }
      if (activeDevice) {
        sendCommandToTv(activeDevice, { type: 'mouse_move', dx: scaledX, dy: scaledY }, 250).catch(() => {});
      }
    },
    [state.mouseSensitivity, activeDevice],
  );

  const handleTouchpadPress = useCallback(() => {
    setPointerStatus('Click');
    if (MagicHardware?.sendMouseClick) {
      MagicHardware.sendMouseClick('left').catch(() => {});
    }
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'mouse_click', button: 'left' }, 250).catch(() => {});
    }
  }, [activeDevice]);

  const handleScroll = useCallback(
    (deltaY: number) => {
      if (MagicHardware?.sendMouseScroll) {
        MagicHardware.sendMouseScroll(deltaY).catch(() => {});
      }
      if (activeDevice) {
        sendCommandToTv(activeDevice, { type: 'scroll', dx: 0, dy: deltaY }, 250).catch(() => {});
      }
    },
    [activeDevice],
  );

  const mouseController: RemoteMouseController = useMemo(
    () => ({
      mode: 'touchpad',
      setMode: () => {},
      pointerSupported,
      airSupported: false,
      pointerStatus,
      airStatus: '',
      sensitivity: state.mouseSensitivity,
      setSensitivity: (val) =>
        setState((prev) => ({ ...prev, mouseSensitivity: val })),
      onTouchpadDelta: handleTouchpadDelta,
      onTouchpadPress: handleTouchpadPress,
      onRightClick: () => {},
      onRecenter: () => {},
      onScroll: handleScroll,
    }),
    [
      pointerSupported,
      pointerStatus,
      state.mouseSensitivity,
      handleTouchpadDelta,
      handleTouchpadPress,
      handleScroll,
    ],
  );
  const handleScanNetwork = useCallback(async () => {
    setScanning(true);
    setDiscoveredDevices([]);
    setScanProgressText('جاري فحص الشبكة المحلية...');

    try {
      const ipAddress = await Network.getIpAddressAsync().catch(() => null);
      const prefix = getSubnetPrefix(ipAddress) ?? '192.168.1';
      const candidates: string[] = [];

      const seedHosts = [1, 2, 10, 20, 50, 100, 101, 102, 110, 150, 200, 254];
      for (const h of seedHosts) {
        candidates.push(`${prefix}.${h}`);
      }
      for (let i = 1; i <= 254; i++) {
        const ip = `${prefix}.${i}`;
        if (!candidates.includes(ip)) {
          candidates.push(ip);
        }
      }

      const found: SavedDevice[] = [];
      const batchSize = 18;

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        setScanProgressText(
          `فحص الشبكة ${prefix}.x (${Math.min(i + batchSize, candidates.length)}/${candidates.length})...`,
        );

        const results = await Promise.all(
          batch.map(async (ip) => {
            const res = await probeTvHost(ip, 5555, 'adb', 500);
            return { ip, res };
          }),
        );

        for (const item of results) {
          if (item.res.reachable) {
            found.push({
              id: `scan-${item.ip}-${Date.now()}-${found.length}`,
              name: item.res.name ?? `Magic TV (${item.ip})`,
              ip: item.ip,
              port: 5555,
              protocol: 'adb',
              transport: 'wifi',
              model: item.res.model,
              lastSeen: 'تم العثور عليه',
            });
          }
        }
      }

      setDiscoveredDevices(found);
      setScanProgressText(
        found.length > 0
          ? `تم العثور على ${found.length} جهاز في الشبكة`
          : `لم يتم العثور على أجهزة تلقائياً في ${prefix}.x — يمكنك إضافته يدوياً بالـ IP`,
      );
    } catch {
      setScanProgressText('تعذر فحص الشبكة — تحقق من اتصال Wi-Fi');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleScanBluetooth = useCallback(async () => {
    setBtScanning(true);
    try {
      const allowed = await requestBluetoothPermissions();
      if (!allowed) {
        Alert.alert('صلاحيات البلوتوث', 'لازم تسمح بالبحث والاتصال بجهاز Bluetooth HID.');
        return;
      }
      if (MagicHardware?.scanBluetoothDevices) {
        const list = await MagicHardware.scanBluetoothDevices();
        setBtDevices(
          (list ?? []).map((item, idx) => ({
            name: item.name?.trim() || `BT Device ${idx + 1}`,
            address: item.address?.trim() || `00:11:22:33:44:${(idx + 10).toString(16)}`,
            bondState: item.bondState,
          })),
        );
      } else {
        setBtDevices([]);
        Alert.alert(
          'Bluetooth HID',
          'ماسح البلوتوث الأصلي متوفر داخل بناء Native APK المفعّل بـ withMagicHardware.',
        );
      }
    } finally {
      setBtScanning(false);
    }
  }, [requestBluetoothPermissions]);

  const handleSaveManualDevice = useCallback(() => {
    const cleanIp = manualIp.trim();
    const parsedPort = Number(manualPort.trim()) || 5555;

    if (manualTransport === 'wifi' && !isValidIpv4(cleanIp)) {
      Alert.alert('عنوان IP غير صحيح', 'يرجى إدخال عنوان IP صحيح مثل 192.168.1.120');
      return;
    }

    const newDevice: SavedDevice = {
      id: `dev-${Date.now()}`,
      name: manualName.trim() || 'Magic A200 Pro',
      ip: manualTransport === 'wifi' ? cleanIp : '0.0.0.0',
      port: parsedPort,
      protocol: manualProtocol,
      transport: manualTransport,
      bluetoothMac: manualTransport === 'bluetooth' ? manualBtMac.trim() : undefined,
      lastSeen: 'مضاف حديثاً',
    };

    setState((prev) => ({
      ...prev,
      devices: [newDevice, ...prev.devices],
      activeDeviceId: newDevice.id,
    }));

    setDeviceModalVisible(false);
    connectToDevice(newDevice);
  }, [
    manualName,
    manualIp,
    manualPort,
    manualProtocol,
    manualTransport,
    manualBtMac,
    connectToDevice,
  ]);

  const handleAddDiscoveredDevice = useCallback(
    (dev: SavedDevice) => {
      setState((prev) => {
        const exists = prev.devices.some(
          (d) => d.ip === dev.ip && d.port === dev.port,
        );
        const updated = exists
          ? prev.devices.map((d) =>
              d.ip === dev.ip && d.port === dev.port ? { ...d, ...dev } : d,
            )
          : [dev, ...prev.devices];
        return {
          ...prev,
          devices: updated,
          activeDeviceId: dev.id,
        };
      });
      setDeviceModalVisible(false);
      connectToDevice(dev);
    },
    [connectToDevice],
  );

  const handleRemoveDevice = useCallback((deviceId: string) => {
    setState((prev) => {
      const remaining = prev.devices.filter((d) => d.id !== deviceId);
      const nextActive =
        prev.activeDeviceId === deviceId
          ? remaining[0]?.id ?? null
          : prev.activeDeviceId;
      return {
        ...prev,
        devices: remaining,
        activeDeviceId: nextActive,
      };
    });
  }, []);

  const handleAddCustomApp = useCallback(() => {
    const title = newAppName.trim();
    const pkg = newAppPackage.trim();
    if (!title || !pkg) {
      Alert.alert('نقص في البيانات', 'أدخل اسم التطبيق واسم الحزمة (Package Name)');
      return;
    }

    const shortcut: RemoteAppShortcut = {
      id: `app-${Date.now()}`,
      name: title,
      packageName: pkg,
      icon: 'apps-outline',
    };

    setState((prev) => ({
      ...prev,
      customApps: [...prev.customApps, shortcut],
    }));
    setNewAppName('');
    setNewAppPackage('');
    setAddAppModalVisible(false);
  }, [newAppName, newAppPackage]);
  const statusColor =
    connectionStatus === 'connected'
      ? '#34D399'
      : connectionStatus === 'connecting'
        ? '#FBBF24'
        : '#F87171';

  const statusLabel =
    connectionStatus === 'connected'
      ? 'متصل'
      : connectionStatus === 'connecting'
        ? 'جاري الاتصال'
        : 'غير متصل';

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} hidden />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top * 0.15, 6),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor, opacity: pulseAnim },
            ]}
          />
          <View style={styles.headerTitles}>
            <Text style={[styles.brandTitle, { color: colors.text }]} numberOfLines={1}>
              ريموت العقابي
            </Text>
            <Text
              style={[styles.deviceSubtitle, { color: colors.secondary }]}
              numberOfLines={1}
            >
              {activeDevice
                ? `${activeDevice.name} · ${statusLabel}`
                : `Magic A200 Pro · ${statusLabel}`}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إرسال نص"
            onPress={() => setTextModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="keypad-outline" size={18} color={colors.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تطبيقات التلفاز"
            onPress={() => setAppsModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="apps-outline" size={18} color="#7CE3C3" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الأجهزة والاتصال"
            onPress={() => setDeviceModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="tv-outline" size={18} color="#7CE3C3" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الإعدادات"
            onPress={() => setSettingsModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.feedbackBar,
          { backgroundColor: colors.cardAlt, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[styles.feedbackText, { color: colors.secondary }]}
          numberOfLines={1}
        >
          {lastFeedback}
        </Text>
        {lastActionBadge ? (
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{lastActionBadge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.screenContent}>
        {screen === 'remote' ? (
          <RemoteExperience
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSendKey={handleSendKey}
            onOpenSettings={() => setSettingsModalVisible(true)}
            colors={colors}
            isConnected={connectionStatus === 'connected'}
            apps={state.customApps}
            onLaunchApp={handleLaunchApp}
            mouse={mouseController}
          />
        ) : (
          <AcPanel
            colors={colors}
            onSendIr={handleSendAcIr}
            disabled={!MagicHardware?.transmitIr}
          />
        )}
      </View>

      <View
        style={[
          styles.bottomNav,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom * 0.2, 6),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: screen === 'remote' }}
          onPress={() => setScreen('remote')}
          style={styles.bottomNavButton}
        >
          <Ionicons
            name="radio-outline"
            size={19}
            color={screen === 'remote' ? '#7CE3C3' : colors.secondary}
          />
          <Text
            style={[
              styles.bottomNavText,
              { color: screen === 'remote' ? '#7CE3C3' : colors.secondary },
            ]}
          >
            ريموت
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: screen === 'ac' }}
          onPress={() => setScreen('ac')}
          style={styles.bottomNavButton}
        >
          <Ionicons
            name="snow-outline"
            size={19}
            color={screen === 'ac' ? '#7CE3C3' : colors.secondary}
          />
          <Text
            style={[
              styles.bottomNavText,
              { color: screen === 'ac' ? '#7CE3C3' : colors.secondary },
            ]}
          >
            سبلت
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={deviceModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeviceModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                إدارة الأجهزة والاتصال
              </Text>
              <Pressable onPress={() => setDeviceModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                الأجهزة المحفوظة
              </Text>

              {state.devices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                  لا توجد أجهزة محفوظة حالياً. ابحث في الشبكة أو أضف جهازك يدوياً.
                </Text>
              ) : (
                state.devices.map((dev) => {
                  const isSelected = dev.id === state.activeDeviceId;
                  return (
                    <View
                      key={dev.id}
                      style={[
                        styles.deviceRow,
                        {
                          backgroundColor: isSelected ? colors.cardAlt : colors.input,
                          borderColor: isSelected ? '#7CE3C3' : colors.border,
                        },
                      ]}
                    >
                      <Pressable
                        style={styles.deviceRowMain}
                        onPress={() => {
                          setDeviceModalVisible(false);
                          connectToDevice(dev);
                        }}
                      >
                        <Text style={[styles.deviceName, { color: colors.text }]}>
                          {dev.name}
                        </Text>
                        <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                          {dev.transport === 'bluetooth'
                            ? `Bluetooth HID · ${dev.bluetoothMac || 'مقترن'}`
                            : `${dev.ip}:${dev.port} · ${dev.protocol.toUpperCase()}`}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveDevice(dev.id)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#F87171" />
                      </Pressable>
                    </View>
                  );
                })
              )}

              <View style={styles.scanActionsRow}>
                <Pressable
                  onPress={handleScanNetwork}
                  disabled={scanning}
                  style={[styles.primaryActionBtn, { backgroundColor: '#7CE3C3' }]}
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color="#081012" />
                  ) : (
                    <Ionicons name="wifi-outline" size={18} color="#081012" />
                  )}
                  <Text style={styles.primaryActionText}>
                    {scanning ? 'جاري الفحص...' : 'فحص شبكة Wi-Fi'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleScanBluetooth}
                  disabled={btScanning}
                  style={[
                    styles.secondaryActionBtn,
                    { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                >
                  {btScanning ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Ionicons name="bluetooth-outline" size={18} color={colors.text} />
                  )}
                  <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                    أجهزة Bluetooth
                  </Text>
                </Pressable>
              </View>

              {scanProgressText ? (
                <Text style={[styles.scanStatusText, { color: colors.secondary }]}>
                  {scanProgressText}
                </Text>
              ) : null}

              {discoveredDevices.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleAddDiscoveredDevice(item)}
                  style={[
                    styles.discoveredRow,
                    { backgroundColor: colors.cardAlt, borderColor: '#7CE3C3' },
                  ]}
                >
                  <View>
                    <Text style={[styles.deviceName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                      {item.ip}:{item.port}
                    </Text>
                  </View>
                  <Text style={styles.connectPillText}>اتصال</Text>
                </Pressable>
              ))}

              {btDevices.map((bt) => (
                <Pressable
                  key={bt.address}
                  onPress={() => {
                    const btDev: SavedDevice = {
                      id: `bt-${bt.address}`,
                      name: bt.name,
                      ip: '0.0.0.0',
                      port: 0,
                      protocol: 'adb',
                      transport: 'bluetooth',
                      bluetoothMac: bt.address,
                      lastSeen: 'Bluetooth HID',
                    };
                    handleAddDiscoveredDevice(btDev);
                  }}
                  style={[
                    styles.discoveredRow,
                    { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                >
                  <View>
                    <Text style={[styles.deviceName, { color: colors.text }]}>
                      {bt.name}
                    </Text>
                    <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                      {bt.address}
                    </Text>
                  </View>
                  <Text style={styles.connectPillText}>ربط HID</Text>
                </Pressable>
              ))}

              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                إضافة يدوية
              </Text>

              <TextInput
                value={manualName}
                onChangeText={setManualName}
                placeholder="اسم الجهاز (مثال: Magic A200 Pro)"
                placeholderTextColor={colors.secondary}
                style={[
                  styles.inputField,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />

              <View style={styles.transportRow}>
                {(['wifi', 'bluetooth'] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setManualTransport(t)}
                    style={[
                      styles.transportChip,
                      {
                        backgroundColor:
                          manualTransport === t ? colors.cardAlt : colors.input,
                        borderColor:
                          manualTransport === t ? '#7CE3C3' : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.transportChipText,
                        { color: manualTransport === t ? '#7CE3C3' : colors.text },
                      ]}
                    >
                      {t === 'wifi' ? 'شبكة Wi-Fi (IP)' : 'Bluetooth HID'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {manualTransport === 'wifi' ? (
                <View style={styles.ipPortRow}>
                  <TextInput
                    value={manualIp}
                    onChangeText={setManualIp}
                    placeholder="192.168.1.100"
                    placeholderTextColor={colors.secondary}
                    keyboardType="numeric"
                    style={[
                      styles.inputField,
                      styles.ipInput,
                      {
                        backgroundColor: colors.input,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                  <TextInput
                    value={manualPort}
                    onChangeText={setManualPort}
                    placeholder="5555"
                    placeholderTextColor={colors.secondary}
                    keyboardType="numeric"
                    style={[
                      styles.inputField,
                      styles.portInput,
                      {
                        backgroundColor: colors.input,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                </View>
              ) : (
                <TextInput
                  value={manualBtMac}
                  onChangeText={setManualBtMac}
                  placeholder="عنوان MAC للبلوتوث (اختياري)"
                  placeholderTextColor={colors.secondary}
                  style={[
                    styles.inputField,
                    {
                      backgroundColor: colors.input,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
              )}

              <Pressable
                onPress={handleSaveManualDevice}
                style={[styles.primaryActionBtn, { backgroundColor: '#7CE3C3' }]}
              >
                <Ionicons name="checkmark-circle-outline" size={19} color="#081012" />
                <Text style={styles.primaryActionText}>حفظ والاتصال</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={textModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setTextModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                إرسال نص إلى التلفاز
              </Text>
              <Pressable onPress={() => setTextModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              value={tvTextInput}
              onChangeText={setTvTextInput}
              placeholder="اكتب كلمة البحث أو النص هنا..."
              placeholderTextColor={colors.secondary}
              autoFocus
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <View style={styles.modalFooterRow}>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setTextModalVisible(false);
                }}
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: colors.cardAlt, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.secondaryActionText, { color: colors.text }]}>
                  إلغاء
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSendTvText}
                disabled={sendingText}
                style={[styles.primaryActionBtn, { backgroundColor: '#7CE3C3' }]}
              >
                <Text style={styles.primaryActionText}>
                  {sendingText ? 'جاري الإرسال...' : 'إرسال النص'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={settingsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                إعدادات الريموت والماوس
              </Text>
              <Pressable onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Pressable
                onPress={() =>
                  setState((prev) => ({
                    ...prev,
                    hapticsEnabled: !prev.hapticsEnabled,
                  }))
                }
                style={[
                  styles.settingToggleRow,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  الاهتزاز اللمسي عند الضغط (Haptics)
                </Text>
                <Text style={styles.settingValueAccent}>
                  {state.hapticsEnabled ? 'مفعّل' : 'متوقف'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  setState((prev) => ({
                    ...prev,
                    autoConnect: !prev.autoConnect,
                  }))
                }
                style={[
                  styles.settingToggleRow,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  الاتصال التلقائي بآخر جهاز
                </Text>
                <Text style={styles.settingValueAccent}>
                  {state.autoConnect ? 'مفعّل' : 'متوقف'}
                </Text>
              </Pressable>

              <View
                style={[
                  styles.sensitivityBox,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  حساسية الماوس واللمس: {state.mouseSensitivity.toFixed(2)}x
                </Text>
                <View style={styles.sensitivityBtnsRow}>
                  {[0.8, 1.35, 1.9, 2.5].map((preset) => {
                    const active =
                      Math.abs(state.mouseSensitivity - preset) < 0.08;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() =>
                          setState((prev) => ({
                            ...prev,
                            mouseSensitivity: preset,
                          }))
                        }
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: active ? '#7CE3C3' : colors.cardAlt,
                            borderColor: active ? '#7CE3C3' : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetPillText,
                            { color: active ? '#081012' : colors.text },
                          ]}
                        >
                          {preset}x
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.customAppsHeader}>
                <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                  اختصارات التطبيقات
                </Text>
                <Pressable
                  onPress={() => {
                    setSettingsModalVisible(false);
                    setAddAppModalVisible(true);
                  }}
                  style={styles.addShortcutBtn}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#7CE3C3" />
                  <Text style={styles.addShortcutText}>إضافة تطبيق</Text>
                </Pressable>
              </View>

              <FlatList
                data={state.customApps}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.shortcutListRow,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}
                  >
                    <View>
                      <Text style={[styles.deviceName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                        {item.packageName}
                      </Text>
                    </View>
                    {state.customApps.length > 1 ? (
                      <Pressable
                        onPress={() =>
                          setState((prev) => ({
                            ...prev,
                            customApps: prev.customApps.filter(
                              (a) => a.id !== item.id,
                            ),
                          }))
                        }
                      >
                        <Ionicons
                          name="remove-circle-outline"
                          size={19}
                          color="#F87171"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                )}
              />

              <Pressable
                onPress={() => setSettingsModalVisible(false)}
                style={[styles.settingsDoneButton, { backgroundColor: '#7CE3C3' }]}
              >
                <Text style={styles.primaryActionText}>تم</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addAppModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAddAppModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                إضافة اختصار تطبيق
              </Text>
              <Pressable onPress={() => setAddAppModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              value={newAppName}
              onChangeText={setNewAppName}
              placeholder="اسم التطبيق (مثال: Plex)"
              placeholderTextColor={colors.secondary}
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <TextInput
              value={newAppPackage}
              onChangeText={setNewAppPackage}
              placeholder="اسم الحزمة (مثال: com.plexapp.android)"
              placeholderTextColor={colors.secondary}
              autoCapitalize="none"
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <Pressable
              onPress={handleAddCustomApp}
              style={[styles.primaryActionBtn, { backgroundColor: '#7CE3C3' }]}
            >
              <Text style={styles.primaryActionText}>حفظ الاختصار</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={appsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAppsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                تطبيقات التلفاز
              </Text>
              <Pressable onPress={() => setAppsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              {state.customApps.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                  لا توجد تطبيقات محفوظة. أضف تطبيقاً من الإعدادات.
                </Text>
              ) : (
                state.customApps.map((app) => (
                  <Pressable
                    key={app.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setAppsModalVisible(false);
                      handleLaunchApp(app.packageName);
                    }}
                    style={[
                      styles.deviceRow,
                      {
                        backgroundColor: colors.cardAlt,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.deviceRowMain}>
                      <Text style={[styles.deviceName, { color: colors.text }]}>
                        {app.name}
                      </Text>
                      <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                        {app.packageName}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color="#7CE3C3" />
                  </Pressable>
                ))
              )}

              <Pressable
                onPress={() => {
                  setAppsModalVisible(false);
                  setAddAppModalVisible(true);
                }}
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: '#7CE3C3' },
                ]}
              >
                <Ionicons name="add-circle-outline" size={19} color="#081012" />
                <Text style={styles.primaryActionText}>إضافة تطبيق</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={pairingModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPairingModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                رمز الاقتران
              </Text>
              <Pressable
                onPress={() => {
                  setPairingModalVisible(false);
                  tvRemote.disconnect();
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
              أدخل الرمز المكوّن من 6 خانات الظاهر على شاشة التلفاز.
            </Text>
            <TextInput
              value={pairingCode}
              onChangeText={(value) => setPairingCode(value.toUpperCase())}
              placeholder="A1B2C3"
              placeholderTextColor={colors.secondary}
              autoCapitalize="characters"
              maxLength={6}
              style={[
                styles.inputField,
                {
                  backgroundColor: colors.input,
                  borderColor: colors.border,
                  color: colors.text,
                  letterSpacing: 4,
                  textAlign: 'center',
                  fontSize: 24,
                },
              ]}
            />
            <Pressable
              disabled={pairingCode.length !== 6}
              onPress={async () => {
                const ok = await tvRemote.submitPairingCode(pairingCode);
                if (ok) setPairingModalVisible(false);
              }}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: pairingCode.length === 6 ? '#7CE3C3' : colors.cardAlt },
              ]}
            >
              <Text
                style={[
                  styles.primaryActionText,
                  { color: pairingCode.length === 6 ? '#081012' : colors.secondary },
                ]}
              >
                تأكيد الاقتران
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
    minHeight: 0,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
  },
  bottomNavButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  bottomNavText: {
    fontSize: 11,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitles: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  deviceSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  badgePill: {
    backgroundColor: '#7CE3C3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#081012',
    fontSize: 10,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    gap: 10,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  deviceRowMain: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '800',
  },
  deviceMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  scanActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: '#081012',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  scanStatusText: {
    fontSize: 11,
    lineHeight: 16,
  },
  discoveredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 13,
    borderWidth: 1,
  },
  connectPillText: {
    color: '#7CE3C3',
    fontSize: 12,
    fontWeight: '900',
  },
  inputField: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  transportRow: {
    flexDirection: 'row',
    gap: 8,
  },
  transportChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transportChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ipPortRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ipInput: {
    flex: 2,
  },
  portInput: {
    flex: 1,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  settingLabel
: { fontSize: 12, fontWeight: '800' },

  settingValueAccent: {
    color: '#7CE3C3',
    fontSize: 12,
    fontWeight: '900',
  },
  sensitivityBox: {
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  sensitivityBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  customAppsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  addShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addShortcutText: {
    color: '#7CE3C3',
    fontSize: 11,
    fontWeight: '800',
  },
  shortcutListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 6,
  },
  settingsDoneButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});
