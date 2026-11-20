import * as Network from 'expo-network';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Appearance,
  AppState,
  FlatList,
  I18nManager,
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
import { Gyroscope } from 'expo-sensors';
import {
  RemoteAppShortcut,
  RemoteExperience,
  RemoteMouseController,
} from '../components/RemoteExperience';
import { AcPanel } from '../components/AcPanel';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { SavedDevice } from '../utils/device';
import {
  AcBrand,
  AcCodeSet,
  AcState,
  buildAcIrPattern,
  createDefaultAcState,
} from '../utils/acIr';
import { RoomProfile } from '../utils/room';
import { TranslationKey, translate } from '../utils/i18n';
import {
  AccentId,
  AppearanceMode,
  Language,
  getAccent,
} from '../utils/theme';
import { TV_BOXES } from '../utils/catalog';
import {
  TvBrand,
  buildTvIrPattern,
} from '../utils/tvIr';
import {
  RemoteKeyName,
  useAndroidTvRemote,
} from '../hooks/useAndroidTvRemote';

const STORAGE_KEY = '@magic_tv_remote_state_v2';
const LEGACY_STORAGE_KEY = '@magic_tv_remote_state_v1';

interface QuickCommand {
  id: string;
  label: TranslationKey;
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface RemoteAppState {
  devices: SavedDevice[];
  activeDeviceId: string | null;
  hapticsEnabled: boolean;
  mouseSensitivity: number;
  autoConnect: boolean;
  keepAwake: boolean;
  language: Language;
  appearance: AppearanceMode;
  accent: AccentId;
  rooms: RoomProfile[];
  activeRoomId: string | null;
  favoritePackages: string[];
  tvBrand: TvBrand;
  tvCodeSet: 1 | 2 | 3;
  acBrand: AcBrand;
  acCodeSet: AcCodeSet;
  acState: AcState;
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
  { id: 'q1', label: 'playPause', action: 'playPause', icon: 'play-skip-forward-outline' },
  { id: 'q2', label: 'mute', action: 'mute', icon: 'volume-mute-outline' },
  { id: 'q3', label: 'recentApps', action: 'recents', icon: 'apps-outline' },
  { id: 'q4', label: 'sleep', action: 'sleep', icon: 'moon-outline' },
];

const INITIAL_STATE: RemoteAppState = {
  devices: [],
  activeDeviceId: null,
  hapticsEnabled: true,
  mouseSensitivity: 1.35,
  autoConnect: true,
  keepAwake: false,
  language: 'ar',
  appearance: 'system',
  accent: 'neonBlue',
  rooms: [],
  activeRoomId: null,
  favoritePackages: DEFAULT_APPS.map((app) => app.packageName),
  tvBrand: 'Nikai',
  tvCodeSet: 1,
  acBrand: 'Tosot',
  acCodeSet: 1,
  acState: createDefaultAcState(),
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
  startVoiceSearch?: () => Promise<string | boolean>;
  sendBluetoothHidText?: (text: string) => Promise<boolean>;
  discoverNetworkDevices?: () => Promise<
    Array<{ name?: string; ip: string; port: number; source?: string }>
  >;
  isBluetoothHidConnected?: () => Promise<boolean>;
  disconnectBluetoothHid?: () => Promise<boolean>;
  startMouseDrag?: (button: 'left' | 'right') => Promise<boolean>;
  endMouseDrag?: () => Promise<boolean>;
  getClipboardText?: () => Promise<string>;
  getInstalledApps?: () => Promise<string[]>;
  getInstalledTvAppsFromHost?: (ip: string, port: number) => Promise<string[]>;
  setKeepAwake?: (enabled: boolean) => Promise<boolean>;
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
            name: isMagic ? 'Magic A200 Pro TV' : `Network device (${ip})`,
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
    detail: `Unreachable at ${device.ip}:${device.port}`,
  };
}
export default function MagicTvRemoteScreen() {
  const insets = useSafeAreaInsets();
  const systemColorScheme = useColorScheme();
  const tvRemote = useAndroidTvRemote();

  const [state, setState] = useState<RemoteAppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  const isDark =
    state.appearance === 'dark' ||
    (state.appearance === 'system' && systemColorScheme !== 'light');
  const accent = getAccent(state.accent).value;
  const t = useCallback(
    (key: TranslationKey) => translate(state.language, key),
    [state.language],
  );

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
            accent,
            accentSoft: `${accent}24`,
          }
        : {
            background: '#F3F6F8',
            card: '#FFFFFF',
            cardAlt: '#E9EFF3',
            border: '#D4DFE6',
            text: '#0F171A',
            secondary: '#5B6D77',
            input: '#F7FAFC',
            accent,
            accentSoft: `${accent}1A`,
          },
    [isDark, accent],
  );

  const [screen, setScreen] = useState<'remote' | 'ac' | 'connection'>('remote');
  const [activeTab, setActiveTab] = useState<'remote' | 'mouse'>('remote');
  const [airMode, setAirMode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected'
  >('disconnected');
  const [lastFeedback, setLastFeedback] = useState<string>(t('ready'));
  const [lastActionBadge, setLastActionBadge] = useState<string | null>(null);

  const [pointerSupported, setPointerSupported] = useState(true);
  const [airSupported, setAirSupported] = useState(false);
  const [pointerStatus, setPointerStatus] = useState(t('touchpad'));
  const [airStatus, setAirStatus] = useState(t('airOff'));
  const [irMissing, setIrMissing] = useState(true);

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
  const [installedApps, setInstalledApps] = useState<RemoteAppShortcut[]>([]);
  const [fetchingApps, setFetchingApps] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState('');
  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(''), 2500);
  }, []);
  const tap = useCallback(() => {
    if (state.hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [state.hapticsEnabled]);
  const activeDevice = useMemo(
    () => state.devices.find((d) => d.id === state.activeDeviceId) ?? null,
    [state.devices, state.activeDeviceId],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw =
          (await AsyncStorage.getItem(STORAGE_KEY)) ??
          (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
        if (raw && mounted) {
          const parsed = JSON.parse(raw) as Partial<RemoteAppState>;
          setState((prev) => ({
            ...prev,
            ...parsed,
            devices: Array.isArray(parsed.devices) ? parsed.devices : prev.devices,
            quickCommands: Array.isArray(parsed.quickCommands)
              ? parsed.quickCommands
              : prev.quickCommands,
            customApps: Array.isArray(parsed.customApps)
              ? parsed.customApps
              : prev.customApps,
            rooms: Array.isArray(parsed.rooms) ? parsed.rooms : prev.rooms,
            favoritePackages: Array.isArray(parsed.favoritePackages)
              ? parsed.favoritePackages
              : prev.favoritePackages,
            acState: parsed.acState
              ? { ...prev.acState, ...parsed.acState }
              : prev.acState,
          }));
        }
      } catch {
        // Ignore corrupt storage and use defaults.
      }
      if (mounted) setHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [hydrated, state]);

  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(state.language === 'ar');
  }, [state.language]);

  useEffect(() => {
    Appearance.setColorScheme(
      state.appearance === 'system' ? 'auto' : state.appearance,
    );
  }, [state.appearance]);

  useEffect(() => {
    if (!hydrated) return;
    MagicHardware?.setKeepAwake?.(state.keepAwake).catch(() => {});
  }, [hydrated, state.keepAwake]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && state.keepAwake) {
        MagicHardware?.setKeepAwake?.(true).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [state.keepAwake]);

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
          showFeedback(`${t('bluetoothPermissionsHelp')}`);
          return;
        }
        if (dev.bluetoothMac && MagicHardware?.pairOrConnectBluetoothHid) {
          setConnectionStatus('connecting');
          try {
            const paired = await MagicHardware.pairOrConnectBluetoothHid(
              dev.bluetoothMac,
            );
            setConnectionStatus(paired ? 'connected' : 'disconnected');
            showFeedback(paired ? `${t('connected')} · ${dev.name}` : t('appsFetchFailed'));
          } catch {
            setConnectionStatus('disconnected');
            showFeedback(t('appsFetchFailed'));
          }
        } else {
          setConnectionStatus('disconnected');
          showFeedback(t('bluetoothPermissionsHelp'));
        }
        return;
      }

      setConnectionStatus('connecting');
      const ok = await tvRemote.connect(dev.ip);
      setConnectionStatus(ok ? 'connecting' : 'disconnected');
      showFeedback(ok ? t('connecting') : tvRemote.error);
    },
    [requestBluetoothPermissions, showFeedback, t, tvRemote.connect],
  );

  useEffect(() => {
    if (!hydrated || !state.autoConnect || !state.activeDeviceId) return;
    const last = state.devices.find((d) => d.id === state.activeDeviceId);
    if (!last) return;
    connectToDevice(last);
  }, [hydrated, state.autoConnect, state.activeDeviceId, state.devices, connectToDevice]);

  const handleSendKey = useCallback(
    (key: string) => {
      tap();
      if (activeDevice?.transport === 'wifi' && tvRemote.isConnected) {
        const keyName = ANDROID_TV_KEY_MAP[key];
        if (key === 'power') tvRemote.sendPower();
        else if (keyName) tvRemote.sendKey(keyName);
        return;
      }
      if (activeDevice) {
        sendCommandToTv(activeDevice, { type: 'key', key }, 200).catch(() => {});
        return;
      }
      const ir = buildTvIrPattern(state.tvBrand, state.tvCodeSet, key);
      MagicHardware?.transmitIr?.(ir.carrierFrequency, ir.pattern).catch(() => {});
    },
    [
      activeDevice,
      state.tvBrand,
      state.tvCodeSet,
      tap,
      tvRemote.isConnected,
      tvRemote.sendKey,
      tvRemote.sendPower,
    ],
  );

  const handleLaunchApp = useCallback(
    async (pkg: string) => {
      if (MagicHardware?.launchTvApp) {
        try {
          const launched = await MagicHardware.launchTvApp(pkg);
          if (launched) {
            showFeedback(`${t('appLaunched')}: ${pkg}`);
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
    [activeDevice, showFeedback, t],
  );

  const handleSendAcIr = useCallback(
    async (brand: AcBrand, acState: AcState, codeSet: AcCodeSet = 1) => {
      tap();
      if (!MagicHardware?.transmitIr || irMissing) {
        showFeedback(t('irMissingShort'));
        return;
      }
      const { carrierFrequency, pattern } = buildAcIrPattern(brand, acState, codeSet);
      try {
        const sent = await MagicHardware.transmitIr(carrierFrequency, pattern);
        showFeedback(sent ? t('irSent') : t('irFailed'));
      } catch {
        showFeedback(t('irFailed'));
      }
    },
    [irMissing, showFeedback, t, tap],
  );

  const handleSendTvText = useCallback(async () => {
    const text = tvTextInput.trim();
    if (!text) {
      showFeedback(t('textPlaceholder'));
      return;
    }

    setSendingText(true);
    let sent = false;
    if (activeDevice?.transport === 'bluetooth' && MagicHardware?.sendBluetoothHidText) {
      try {
        sent = await MagicHardware.sendBluetoothHidText(text);
      } catch {
        sent = false;
      }
    }
    if (!sent && activeDevice) {
      const result = await sendCommandToTv(
        activeDevice,
        { type: 'text', text },
        400,
      ).catch(() => ({ ok: false, detail: '' }));
      sent = result.ok;
    }
    setSendingText(false);
    showFeedback(sent ? `${t('textSent')}: ${text}` : t('textFailed'));
    if (sent) {
      setTvTextInput('');
      Keyboard.dismiss();
      setTextModalVisible(false);
    }
  }, [activeDevice, showFeedback, t, tvTextInput]);

  const handleVoiceSearch = useCallback(async () => {
    if (!MagicHardware?.startVoiceSearch) {
      showFeedback(t('voiceUnavailable'));
      return;
    }
    try {
      const result = await MagicHardware.startVoiceSearch();
      const text = typeof result === 'string' ? result : '';
      if (text) {
        setTvTextInput(text);
        showFeedback(`${t('voiceRecognized')}: ${text}`);
        if (activeDevice) {
          if (
            activeDevice.transport === 'bluetooth' &&
            MagicHardware.sendBluetoothHidText
          ) {
            await MagicHardware.sendBluetoothHidText(text).catch(() => false);
          } else {
            await sendCommandToTv(activeDevice, { type: 'text', text }, 400).catch(
              () => {},
            );
          }
        }
      } else {
        showFeedback(t('voiceNoResult'));
      }
    } catch {
      showFeedback(t('voiceUnavailable'));
    }
  }, [activeDevice, showFeedback, t]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [pointer, air, ir, gyro] = await Promise.all([
        MagicHardware?.isPointerSupported?.().catch(() => false) ?? Promise.resolve(false),
        MagicHardware?.isAirMouseSupported?.().catch(() => false) ?? Promise.resolve(false),
        MagicHardware?.hasIrEmitter?.().catch(() => false) ?? Promise.resolve(false),
        Gyroscope.isAvailableAsync().catch(() => false),
      ]);
      if (!mounted) return;
      setPointerSupported(Boolean(pointer));
      setAirSupported(Boolean(air && gyro));
      setIrMissing(!Boolean(ir));
      setAirStatus(air && gyro ? t('airMouse') : t('airUnavailable'));
    })();
    return () => {
      mounted = false;
    };
  }, [t]);

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

  useEffect(() => {
    if (activeDevice?.transport !== 'bluetooth') return;
    let mounted = true;
    const checkHid = async () => {
      const connected =
        (await MagicHardware?.isBluetoothHidConnected?.().catch(() => false)) ??
        false;
      if (!mounted) return;
      setConnectionStatus(connected ? 'connected' : 'disconnected');
    };
    checkHid();
    const timer = setInterval(checkHid, 2000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [activeDevice?.transport, activeDevice?.bluetoothMac]);

  const handleTouchpadDelta = useCallback(
    (dx: number, dy: number) => {
      const scaledX = Math.round(dx * state.mouseSensitivity);
      const scaledY = Math.round(dy * state.mouseSensitivity);
      setPointerStatus(`${t('mouse')} (${scaledX}, ${scaledY})`);
      if (MagicHardware?.sendMouseMove) {
        MagicHardware.sendMouseMove(scaledX, scaledY).catch(() => {});
      }
      if (activeDevice) {
        sendCommandToTv(activeDevice, { type: 'mouse_move', dx: scaledX, dy: scaledY }, 250).catch(() => {});
      }
    },
    [state.mouseSensitivity, activeDevice, t],
  );

  const handleTouchpadPress = useCallback(() => {
    tap();
    setPointerStatus(t('leftClick'));
    if (MagicHardware?.sendMouseClick) {
      MagicHardware.sendMouseClick('left').catch(() => {});
    }
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'mouse_click', button: 'left' }, 250).catch(() => {});
    }
  }, [activeDevice, t, tap]);

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

  const handleRightClick = useCallback(() => {
    tap();
    MagicHardware?.sendMouseClick?.('right').catch(() => {});
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'mouse_click', button: 'right' }, 250).catch(
        () => {},
      );
    }
    setPointerStatus(t('rightClick'));
  }, [activeDevice, t, tap]);

  const handleDragStart = useCallback(() => {
    tap();
    MagicHardware?.startMouseDrag?.('left').catch(() => {});
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'mouse_drag_start' }, 250).catch(() => {});
    }
    setPointerStatus(t('touchpadHint'));
  }, [activeDevice, t, tap]);

  const handleDragEnd = useCallback(() => {
    MagicHardware?.endMouseDrag?.().catch(() => {});
    if (activeDevice) {
      sendCommandToTv(activeDevice, { type: 'mouse_drag_end' }, 250).catch(() => {});
    }
  }, [activeDevice]);

  const handleRecenter = useCallback(() => {
    MagicHardware?.recenterPointer?.().catch(() => {});
    setPointerStatus(t('recenter'));
    tap();
  }, [t, tap]);

  const handleSetMouseMode = useCallback(
    (mode: 'touchpad' | 'air') => {
      if (mode === 'air' && !airSupported) {
        showFeedback(t('airUnavailable'));
        return;
      }
      tap();
      setAirMode(mode === 'air');
      setAirStatus(mode === 'air' ? t('airMouse') : t('airOff'));
      showFeedback(mode === 'air' ? t('airOn') : t('airOff'));
    },
    [airSupported, showFeedback, t, tap],
  );

  const mouseController: RemoteMouseController = useMemo(
    () => ({
      mode: airMode ? 'air' : 'touchpad',
      setMode: handleSetMouseMode,
      pointerSupported,
      airSupported,
      pointerStatus,
      airStatus,
      sensitivity: state.mouseSensitivity,
      setSensitivity: (val) =>
        setState((prev) => ({ ...prev, mouseSensitivity: val })),
      onTouchpadDelta: handleTouchpadDelta,
      onTouchpadPress: handleTouchpadPress,
      onRightClick: handleRightClick,
      onRecenter: handleRecenter,
      onScroll: handleScroll,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
    }),
    [
      airMode,
      handleSetMouseMode,
      pointerSupported,
      airSupported,
      pointerStatus,
      airStatus,
      state.mouseSensitivity,
      handleTouchpadDelta,
      handleTouchpadPress,
      handleRightClick,
      handleRecenter,
      handleScroll,
      handleDragStart,
      handleDragEnd,
    ],
  );
  useEffect(() => {
    if (!airMode || !airSupported) return;
    let mounted = true;
    Gyroscope.setUpdateInterval(60);
    const subscription = Gyroscope.addListener(({ x, y }) => {
      if (!mounted) return;
      const scale = state.mouseSensitivity * 5;
      const dx = Math.round(-y * scale);
      const dy = Math.round(x * scale);
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        handleTouchpadDelta(dx, dy);
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [airMode, airSupported, handleTouchpadDelta, state.mouseSensitivity]);

  const handleScanNetwork = useCallback(async () => {
    setScanning(true);
    setDiscoveredDevices([]);
    setScanProgressText(t('scanningNetwork'));

    try {
      const found: SavedDevice[] = [];
      const seen = new Set<string>();

      if (MagicHardware?.discoverNetworkDevices) {
        try {
          const nativeDevices = await MagicHardware.discoverNetworkDevices();
          for (const item of nativeDevices ?? []) {
            if (!isValidIpv4(item.ip) || seen.has(item.ip)) continue;
            seen.add(item.ip);
            found.push({
              id: `discover-${item.ip}-${Date.now()}-${found.length}`,
              name: item.name?.trim() || `Magic TV (${item.ip})`,
              ip: item.ip,
              port: Number(item.port) || 5555,
              protocol: 'http',
              transport: 'wifi',
              source: item.source ?? 'mDNS/SSDP',
              model: item.source,
              lastSeen: `${t('discoveredVia')} ${item.source ?? t('networkSource')}`,
            });
          }
          setDiscoveredDevices([...found]);
          setScanProgressText(
            found.length > 0
              ? `${t('foundDevices')}: ${found.length} · mDNS/SSDP`
              : t('scanningNetwork'),
          );
        } catch {
          setScanProgressText(t('scanningNetwork'));
        }
      }

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

      const batchSize = 18;

      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates
          .slice(i, i + batchSize)
          .filter((ip) => !seen.has(ip));
        if (batch.length === 0) continue;
        setScanProgressText(
          `${t('scanningSubnet')} ${prefix}.x (${Math.min(i + batchSize, candidates.length)}/${candidates.length})...`,
        );

        const results = await Promise.all(
          batch.map(async (ip) => {
            const res = await probeTvHost(ip, 5555, 'adb', 500);
            return { ip, res };
          }),
        );

        for (const item of results) {
          if (item.res.reachable && !seen.has(item.ip)) {
            seen.add(item.ip);
            found.push({
              id: `scan-${item.ip}-${Date.now()}-${found.length}`,
              name: item.res.name ?? `Magic TV (${item.ip})`,
              ip: item.ip,
              port: 5555,
              protocol: 'adb',
              transport: 'wifi',
              model: item.res.model,
              lastSeen: t('found'),
              source: 'subnet',
            });
          }
        }
      }

      setDiscoveredDevices(found);
      setScanProgressText(
        found.length > 0
          ? `${t('foundDevices')}: ${found.length}`
          : t('noDevicesOnSubnet'),
      );
    } catch {
      setScanProgressText(t('scanFailed'));
    } finally {
      setScanning(false);
    }
  }, [t]);

  const handleScanBluetooth = useCallback(async () => {
    setBtScanning(true);
    try {
      const allowed = await requestBluetoothPermissions();
      if (!allowed) {
        Alert.alert(t('bluetoothPermissions'), t('bluetoothPermissionsHelp'));
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
          t('btScannerUnavailable'),
        );
      }
    } finally {
      setBtScanning(false);
    }
  }, [requestBluetoothPermissions, t]);

  const handleSaveManualDevice = useCallback(() => {
    const cleanIp = manualIp.trim();
    const parsedPort = Number(manualPort.trim()) || 5555;

    if (manualTransport === 'wifi' && !isValidIpv4(cleanIp)) {
      Alert.alert(t('invalidIp'), t('invalidIpHelp'));
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
      lastSeen: t('addedRecently'),
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
    t,
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
      Alert.alert(t('addApp'), t('appsHelp'));
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
  }, [newAppName, newAppPackage, t]);

  const handleFetchInstalledApps = useCallback(async () => {
    setFetchingApps(true);
    try {
      let packages: string[] = [];
      if (
        activeDevice?.transport === 'wifi' &&
        MagicHardware?.getInstalledTvAppsFromHost
      ) {
        packages = await MagicHardware.getInstalledTvAppsFromHost(
          activeDevice.ip,
          activeDevice.port || 5555,
        ).catch(() => []);
      }
      if (packages.length === 0 && MagicHardware?.getInstalledApps) {
        packages = await MagicHardware.getInstalledApps().catch(() => []);
      }
      const apps = packages
        .filter(Boolean)
        .map((pkg, index) => ({
          id: `installed-${pkg}-${index}`,
          name: pkg.split('.').pop() ?? pkg,
          packageName: pkg,
          icon: 'apps-outline' as const,
        }));
      setInstalledApps(apps);
      setAppsModalVisible(true);
      if (apps.length === 0) showFeedback(t('appsFetchFailed'));
    } catch {
      showFeedback(t('appsFetchFailed'));
    } finally {
      setFetchingApps(false);
    }
  }, [activeDevice, showFeedback, t]);

  const handleQuickPaste = useCallback(async () => {
    const text = await MagicHardware?.getClipboardText?.().catch(() => '');
    if (!text) {
      showFeedback(t('clipboardEmpty'));
      return;
    }
    setTvTextInput(text);
    setTextModalVisible(true);
  }, [showFeedback, t]);

  const handleToggleFavorite = useCallback((pkg: string) => {
    setState((prev) => ({
      ...prev,
      favoritePackages: prev.favoritePackages.includes(pkg)
        ? prev.favoritePackages.filter((item) => item !== pkg)
        : [...prev.favoritePackages, pkg],
    }));
  }, []);

  const handleAcStateChange = useCallback(
    (brand: AcBrand, codeSet: AcCodeSet, acState: AcState) => {
      setState((prev) => ({
        ...prev,
        acBrand: brand,
        acCodeSet: codeSet,
        acState,
      }));
    },
    [],
  );

  const handleSaveRoom = useCallback(() => {
    const room: RoomProfile = {
      id: `room-${Date.now()}`,
      name: `${activeDevice?.name ?? t('magicRemote')} ${state.rooms.length + 1}`,
      deviceId: state.activeDeviceId,
      tvBrand: state.tvBrand,
      tvCodeSet: state.tvCodeSet,
      acBrand: state.acBrand,
      acCodeSet: state.acCodeSet,
      acState: state.acState,
    };
    setState((prev) => ({
      ...prev,
      rooms: [...prev.rooms, room],
      activeRoomId: room.id,
    }));
    showFeedback(t('roomSaved'));
  }, [activeDevice?.name, showFeedback, state.acBrand, state.acCodeSet, state.acState, state.activeDeviceId, state.rooms.length, state.tvBrand, state.tvCodeSet, t]);

  const handleActivateRoom = useCallback(
    (room: RoomProfile) => {
      setState((prev) => ({
        ...prev,
        activeRoomId: room.id,
        activeDeviceId: room.deviceId,
        tvBrand: room.tvBrand as TvBrand,
        tvCodeSet: room.tvCodeSet,
        acBrand: room.acBrand,
        acCodeSet: room.acCodeSet,
        acState: room.acState,
      }));
      const device = state.devices.find((item) => item.id === room.deviceId);
      if (device) connectToDevice(device);
      showFeedback(t('roomActivated'));
    },
    [connectToDevice, showFeedback, state.devices, t],
  );

  const statusColor =
    connectionStatus === 'connected'
      ? '#34D399'
      : connectionStatus === 'connecting'
        ? '#FBBF24'
        : '#F87171';

  const statusLabel =
    connectionStatus === 'connected'
      ? t('connected')
      : connectionStatus === 'connecting'
        ? t('connecting')
        : t('disconnected');

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
              {t('magicRemote')}
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
            accessibilityLabel={t('keyboard')}
            onPress={() => setTextModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="keypad-outline" size={18} color={accent} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('apps')}
            onPress={() => setAppsModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="apps-outline" size={18} color={accent} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('connection')}
            onPress={() => setDeviceModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="tv-outline" size={18} color={accent} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings')}
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
            onOpenKeyboard={() => setTextModalVisible(true)}
            onOpenApps={() => setAppsModalVisible(true)}
            onQuickPaste={handleQuickPaste}
            onVoiceSearch={handleVoiceSearch}
            t={t}
            colors={colors}
            isConnected={connectionStatus === 'connected'}
            apps={state.customApps.filter((app) =>
              state.favoritePackages.includes(app.packageName),
            )}
            onLaunchApp={handleLaunchApp}
            mouse={mouseController}
          />
        ) : screen === 'ac' ? (
          <AcPanel
            colors={colors}
            t={t}
            onSendIr={handleSendAcIr}
            onStateChange={handleAcStateChange}
            initialBrand={state.acBrand}
            initialCodeSet={state.acCodeSet}
            initialState={state.acState}
            disabled={!MagicHardware?.transmitIr || irMissing}
            irMissing={irMissing}
          />
        ) : (
          <ConnectionPanel
            colors={colors}
            t={t}
            devices={state.devices}
            activeDeviceId={state.activeDeviceId}
            connectionStatus={connectionStatus}
            scanning={scanning}
            scanProgressText={scanProgressText}
            discoveredDevices={discoveredDevices}
            btDevices={btDevices}
            btScanning={btScanning}
            irMissing={irMissing}
            pointerSupported={pointerSupported}
            airSupported={airSupported}
            hapticsEnabled={state.hapticsEnabled}
            autoConnect={state.autoConnect}
            keepAwake={state.keepAwake}
            sensitivity={state.mouseSensitivity}
            language={state.language}
            appearance={state.appearance}
            accentId={state.accent}
            rooms={state.rooms}
            activeRoomId={state.activeRoomId}
            tvBrand={state.tvBrand}
            tvCodeSet={state.tvCodeSet}
            onConnect={connectToDevice}
            onDisconnect={() => {
              tvRemote.disconnect();
              if (activeDevice?.transport === 'bluetooth') {
                MagicHardware?.disconnectBluetoothHid?.().catch(() => {});
              }
              setState((prev) => ({ ...prev, activeDeviceId: null }));
              setConnectionStatus('disconnected');
              showFeedback(t('disconnectedDevice'));
            }}
            onRemove={handleRemoveDevice}
            onScanNetwork={handleScanNetwork}
            onScanBluetooth={handleScanBluetooth}
            onOpenManual={() => setDeviceModalVisible(true)}
            onToggleHaptics={() =>
              setState((prev) => ({ ...prev, hapticsEnabled: !prev.hapticsEnabled }))
            }
            onToggleAutoConnect={() =>
              setState((prev) => ({ ...prev, autoConnect: !prev.autoConnect }))
            }
            onToggleKeepAwake={() =>
              setState((prev) => ({ ...prev, keepAwake: !prev.keepAwake }))
            }
            onSensitivityChange={(value) =>
              setState((prev) => ({ ...prev, mouseSensitivity: value }))
            }
            onLanguageChange={(language) =>
              setState((prev) => ({ ...prev, language }))
            }
            onAppearanceChange={(appearance) =>
              setState((prev) => ({ ...prev, appearance }))
            }
            onAccentChange={(accentId) =>
              setState((prev) => ({ ...prev, accent: accentId }))
            }
            onSaveRoom={handleSaveRoom}
            onActivateRoom={handleActivateRoom}
            onDeleteRoom={(id) =>
              setState((prev) => ({
                ...prev,
                rooms: prev.rooms.filter((room) => room.id !== id),
              }))
            }
            onTvBrandChange={(brand) =>
              setState((prev) => ({ ...prev, tvBrand: brand as TvBrand }))
            }
            onTvCodeSetChange={(tvCodeSet) =>
              setState((prev) => ({ ...prev, tvCodeSet }))
            }
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
            color={screen === 'remote' ? accent : colors.secondary}
          />
          <Text
            style={[
              styles.bottomNavText,
              { color: screen === 'remote' ? accent : colors.secondary },
            ]}
          >
            {t('remote')}
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
            color={screen === 'ac' ? accent : colors.secondary}
          />
          <Text
            style={[
              styles.bottomNavText,
              { color: screen === 'ac' ? accent : colors.secondary },
            ]}
          >
            {t('ac')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: screen === 'connection' }}
          onPress={() => setScreen('connection')}
          style={styles.bottomNavButton}
        >
          <Ionicons
            name="settings-outline"
            size={19}
            color={screen === 'connection' ? accent : colors.secondary}
          />
          <Text
            style={[
              styles.bottomNavText,
              { color: screen === 'connection' ? accent : colors.secondary },
            ]}
          >
            {t('connection')}
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
                {t('connectionTitle')}
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
                {t('savedDevices')}
              </Text>

              {state.devices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                  {t('noSavedDevices')}
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
                          borderColor: isSelected ? accent : colors.border,
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
                            ? `Bluetooth HID · ${dev.bluetoothMac || t('paired')}`
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
                  style={[styles.primaryActionBtn, { backgroundColor: accent }]}
                >
                  {scanning ? (
                    <ActivityIndicator size="small" color="#081012" />
                  ) : (
                    <Ionicons name="wifi-outline" size={18} color="#081012" />
                  )}
                  <Text style={styles.primaryActionText}>
                    {scanning ? t('scanningNetwork') : t('scanNetwork')}
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
                    {t('scanBluetooth')}
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
                    { backgroundColor: colors.cardAlt, borderColor: accent },
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
                  <Text style={styles.connectPillText}>{t('connect')}</Text>
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
                  <Text style={styles.connectPillText}>{t('bindHid')}</Text>
                </Pressable>
              ))}

              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                {t('manualAdd')}
              </Text>

              <TextInput
                value={manualName}
                onChangeText={setManualName}
                placeholder={t('deviceName')}
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
                {(['wifi', 'bluetooth'] as const).map((transport) => (
                  <Pressable
                    key={transport}
                    onPress={() => setManualTransport(transport)}
                    style={[
                      styles.transportChip,
                      {
                        backgroundColor:
                          manualTransport === transport ? accent : colors.input,
                        borderColor:
                          manualTransport === transport ? accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.transportChipText,
                        {
                          color:
                            manualTransport === transport ? colors.text : colors.text,
                        },
                      ]}
                    >
                      {transport === 'wifi' ? 'Wi-Fi (IP)' : 'Bluetooth HID'}
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
                  placeholder={t('btMacPlaceholder')}
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

              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                {t('tvBoxes')}
              </Text>
              {TV_BOXES.map((box) => (
                <Pressable
                  key={box.id}
                  onPress={() => {
                    setManualName(box.name);
                    setManualPort(String(box.port));
                    setManualProtocol(box.protocol);
                    setManualTransport('wifi');
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
                      {box.name}
                    </Text>
                    <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                      {box.hints.join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.deviceMeta, { color: accent }]}>
                    {box.port}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                onPress={handleSaveManualDevice}
                style={[styles.primaryActionBtn, { backgroundColor: accent }]}
              >
                <Ionicons name="checkmark-circle-outline" size={19} color="#081012" />
                <Text style={styles.primaryActionText}>{t('saveAndConnect')}</Text>
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
                {t('textTitle')}
              </Text>
              <Pressable onPress={() => setTextModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              value={tvTextInput}
              onChangeText={setTvTextInput}
              placeholder={t('textPlaceholder')}
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
                  {t('cancel')}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSendTvText}
                disabled={sendingText}
                style={[styles.primaryActionBtn, { backgroundColor: accent }]}
              >
                <Text style={styles.primaryActionText}>
                  {sendingText ? t('sending') : t('sendText')}
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
                {t('settings')}
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
                  {t('haptics')}
                </Text>
                <Text style={styles.settingValueAccent}>
                  {state.hapticsEnabled ? t('enabled') : t('disabled')}
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
                  {t('autoConnect')}
                </Text>
                <Text style={styles.settingValueAccent}>
                  {state.autoConnect ? t('enabled') : t('disabled')}
                </Text>
              </Pressable>

              <View
                style={[
                  styles.sensitivityBox,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('sensitivity')}: {state.mouseSensitivity.toFixed(2)}x
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
                            backgroundColor: active ? accent : colors.cardAlt,
                            borderColor: active ? accent : colors.border,
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
                  {t('apps')}
                </Text>
                <Pressable
                  onPress={() => {
                    setSettingsModalVisible(false);
                    setAddAppModalVisible(true);
                  }}
                  style={styles.addShortcutBtn}
                >
                  <Ionicons name="add-circle-outline" size={18} color={accent} />
                  <Text style={styles.addShortcutText}>{t('addApp')}</Text>
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
                style={[styles.settingsDoneButton, { backgroundColor: accent }]}
              >
                <Text style={styles.primaryActionText}>{t('done')}</Text>
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
                {t('addApp')}
              </Text>
              <Pressable onPress={() => setAddAppModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              value={newAppName}
              onChangeText={setNewAppName}
              placeholder={t('appNamePlaceholder')}
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
              placeholder={t('packagePlaceholder')}
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
              style={[styles.primaryActionBtn, { backgroundColor: accent }]}
            >
              <Text style={styles.primaryActionText}>{t('saveShortcut')}</Text>
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
                {t('apps')}
              </Text>
              <Pressable onPress={() => setAppsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Pressable
                onPress={handleFetchInstalledApps}
                disabled={fetchingApps}
                style={[styles.primaryActionBtn, { backgroundColor: accent }]}
              >
                {fetchingApps ? (
                  <ActivityIndicator size="small" color="#081012" />
                ) : (
                  <Ionicons name="refresh-outline" size={19} color="#081012" />
                )}
                <Text style={styles.primaryActionText}>
                  {fetchingApps ? t('fetchingApps') : t('fetchApps')}
                </Text>
              </Pressable>
              <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                {t('appsHelp')}
              </Text>

              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                {t('installedApps')}
              </Text>
              {installedApps.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                  {t('noApps')}
                </Text>
              ) : (
                installedApps.map((app) => {
                  const favorite = state.favoritePackages.includes(app.packageName);
                  return (
                    <View
                      key={app.id}
                      style={[
                        styles.deviceRow,
                        {
                          backgroundColor: colors.cardAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Pressable
                        style={styles.deviceRowMain}
                        onPress={() => {
                          setAppsModalVisible(false);
                          handleLaunchApp(app.packageName);
                        }}
                      >
                        <Text style={[styles.deviceName, { color: colors.text }]}>
                          {app.name}
                        </Text>
                        <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                          {app.packageName}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          favorite ? 'removeFavorite' : 'addFavorite',
                        )}
                        onPress={() => handleToggleFavorite(app.packageName)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons
                          name={favorite ? 'star' : 'star-outline'}
                          size={19}
                          color={accent}
                        />
                      </Pressable>
                    </View>
                  );
                })
              )}

              <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
                {t('allApps')}
              </Text>
              {state.customApps.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.secondary }]}>
                  {t('noApps')}
                </Text>
              ) : (
                state.customApps.map((app) => {
                  const favorite = state.favoritePackages.includes(app.packageName);
                  return (
                    <View
                      key={app.id}
                      style={[
                        styles.deviceRow,
                        {
                          backgroundColor: colors.cardAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Pressable
                        style={styles.deviceRowMain}
                        onPress={() => {
                          setAppsModalVisible(false);
                          handleLaunchApp(app.packageName);
                        }}
                      >
                        <Text style={[styles.deviceName, { color: colors.text }]}>
                          {app.name}
                        </Text>
                        <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                          {app.packageName}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t(
                          favorite ? 'removeFavorite' : 'addFavorite',
                        )}
                        onPress={() => handleToggleFavorite(app.packageName)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons
                          name={favorite ? 'star' : 'star-outline'}
                          size={19}
                          color={accent}
                        />
                      </Pressable>
                    </View>
                  );
                })
              )}

              <Pressable
                onPress={() => {
                  setAppsModalVisible(false);
                  setAddAppModalVisible(true);
                }}
                style={[styles.primaryActionBtn, { backgroundColor: accent }]}
              >
                <Ionicons name="add-circle-outline" size={19} color="#081012" />
                <Text style={styles.primaryActionText}>{t('addApp')}</Text>
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
                {t('pairing')}
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
              {t('pairingHelp')}
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
                { backgroundColor: pairingCode.length === 6 ? accent : colors.cardAlt },
              ]}
            >
              <Text
                style={[
                  styles.primaryActionText,
                  { color: pairingCode.length === 6 ? '#081012' : colors.secondary },
                ]}
              >
                {t('confirmPairing')}
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
