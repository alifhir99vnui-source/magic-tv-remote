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
  RemoteMouseMode,
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
import { createThrottle } from '../utils/inputThrottle';
import { TranslationKey, translate } from '../utils/i18n';
import {
  ACCENT_THEMES,
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
  tvBrand: 'Magic',
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
  runTvShellCommand?: (
    ip: string,
    port: number,
    command: string,
  ) => Promise<boolean>;
  getTvDeviceIdentity?: (
    ip: string,
    port: number,
  ) => Promise<{ name?: string; model?: string }>;
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
  source: { androidKeyCode: 178, label: 'TV_INPUT' },
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
  pageUp: { androidKeyCode: 92, label: 'PAGE_UP' },
  pageDown: { androidKeyCode: 93, label: 'PAGE_DOWN' },
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
  voice: { androidKeyCode: 231, label: 'VOICE_ASSIST' },
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
  source: 'KEYCODE_TV_INPUT',
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
  pageUp: 'KEYCODE_PAGE_UP',
  pageDown: 'KEYCODE_PAGE_DOWN',
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

const ROUTER_NAME_PATTERN =
  /linux|\/upnp\/|upnp\/1\.0|router|gateway|openwrt|dd-wrt|ddwrt|busybox|access point|hotspot|modem/i;
const TV_NAME_PATTERN =
  /magic|a200|android\s*tv|smart\s*tv|leanback|bravia|webos|tizen|roku|chromecast|hisense|samsung|tcl|xiaomi|toshiba|sharp|philips|starsat|skyworth|tv\s*box|android\s*box/i;

function isRouterishName(name?: string | null): boolean {
  if (!name) return false;
  return ROUTER_NAME_PATTERN.test(name);
}

function extractXmlValue(text: string, key: string): string {
  const xml = new RegExp(`<[^>]*${key}[^>]*>([^<]+)<\\/[^>]*>`, 'i');
  const json = new RegExp(`["']${key}["']\\s*:\\s*["']([^"']+)["']`, 'i');
  return (
    text.match(xml)?.[1]?.trim() ||
    text.match(json)?.[1]?.trim() ||
    ''
  );
}

async function probeTvHost(
  ip: string,
  port: number,
  protocol: 'adb' | 'ws' | 'http',
  timeoutMs = 650,
): Promise<{
  reachable: boolean;
  name?: string;
  model?: string;
  port?: number;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const portsToCheck = Array.from(
    new Set([port, 5555, 6467, 6466, 8090, 8008, 8060, 7676, 80]),
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
        const friendlyName =
          extractXmlValue(text, 'friendlyName') ||
          extractXmlValue(text, 'deviceName') ||
          extractXmlValue(text, 'name');
        const knownTvPort = [5555, 6467, 6466, 8090, 8008, 8060, 7676].includes(
          candidatePort,
        );
        if (isRouterishName(friendlyName) || isRouterishName(text.slice(0, 600))) {
          continue;
        }
        const looksLikeTv =
          TV_NAME_PATTERN.test(friendlyName) ||
          TV_NAME_PATTERN.test(text.slice(0, 4000));
        if (!looksLikeTv && !knownTvPort) continue;
        clearTimeout(timer);
        const name =
          friendlyName || (looksLikeTv ? `Android TV (${ip})` : `TV Box (${ip})`);
        return {
          reachable: true,
          name,
          model: `Port ${candidatePort} · ${protocol.toUpperCase()}`,
          port: candidatePort,
        };
      } catch {}
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
  const [mouseMode, setMouseMode] = useState<RemoteMouseMode>('pointer');
  const [scrollInverted, setScrollInverted] = useState(false);
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
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareUrlInput, setShareUrlInput] = useState('');

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
  const keyThrottleRef = useRef(createThrottle(40));
  const pointerDeltaRef = useRef({ x: 0, y: 0 });
  const pointerFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pointerFlushRef.current) clearTimeout(pointerFlushRef.current);
    },
    [],
  );
  const mouseScrollThrottleRef = useRef(createThrottle(30));
  const airMoveThrottleRef = useRef(createThrottle(30));
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

  const resolveDeviceIdentity = useCallback(async (dev: SavedDevice) => {
    if (dev.transport !== 'wifi') return null;
    const native = await MagicHardware?.getTvDeviceIdentity?.(
      dev.ip,
      dev.port || 5555,
    ).catch(() => null);
    const networkName = native?.name;
    const probe = networkName
      ? null
      : await probeTvHost(dev.ip, dev.port || 5555, 'adb', 900).catch(() => ({
          reachable: false,
          name: undefined,
          model: undefined,
        }));
    const name = networkName || probe?.name;
    if (!name || isRouterishName(name)) return null;
    return { name, model: native?.model || probe?.model };
  }, []);

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
      if (ok) {
        const identity = await resolveDeviceIdentity(dev);
        if (identity) {
          setState((prev) => ({
            ...prev,
            devices: prev.devices.map((item) =>
              item.id === dev.id
                ? { ...item, name: identity.name, model: identity.model ?? item.model }
                : item,
            ),
          }));
          showFeedback(`${t('connected')} · ${identity.name}`);
        } else {
          showFeedback(t('connecting'));
        }
      } else {
        showFeedback(tvRemote.error);
      }
    },
    [
      requestBluetoothPermissions,
      resolveDeviceIdentity,
      showFeedback,
      t,
      tvRemote.connect,
    ],
  );

  useEffect(() => {
    if (!hydrated || !state.autoConnect || !state.activeDeviceId) return;
    const last = state.devices.find((d) => d.id === state.activeDeviceId);
    if (!last) return;
    connectToDevice(last);
  }, [hydrated, state.autoConnect, state.activeDeviceId, state.devices, connectToDevice]);

  const sendTvShellCommand = useCallback(
    async (command: string, timeoutMs = 1200): Promise<boolean> => {
      if (!activeDevice || activeDevice.transport !== 'wifi') return false;
      try {
        const native = await MagicHardware?.runTvShellCommand?.(
          activeDevice.ip,
          activeDevice.port || 5555,
          command,
        );
        if (native) return true;
      } catch {}
      const result = await sendCommandToTv(
        activeDevice,
        { type: 'shell', command },
        timeoutMs,
      ).catch(() => ({ ok: false, detail: '' }));
      return result.ok;
    },
    [activeDevice],
  );

  const handleSendKey = useCallback(
    async (key: string): Promise<boolean> => {
      if (!keyThrottleRef.current()) return false;
      tap();
      let sent = false;

      if (activeDevice?.transport === 'wifi' && tvRemote.isConnected) {
        if (key === 'power') {
          sent = tvRemote.sendPower();
        } else {
          const keyName = ANDROID_TV_KEY_MAP[key];
          if (keyName) sent = tvRemote.sendKey(keyName);
        }
      }

      if (!sent && activeDevice) {
        const result = await sendCommandToTv(
          activeDevice,
          { type: 'key', key, androidKeyCode: KEYCODE_MAP[key]?.androidKeyCode },
          200,
        ).catch(() => ({ ok: false, detail: '' }));
        sent = result.ok;
      }

      if (!sent && key === 'settings') {
        sent = await sendTvShellCommand('am start -a android.settings.SETTINGS');
      }

      if (!sent && MagicHardware?.transmitIr && !irMissing) {
          const ir = buildTvIrPattern(state.tvBrand, state.tvCodeSet, key, 38000);
          try {
            sent = Boolean(await MagicHardware.transmitIr(ir.carrierFrequency, ir.pattern));
          } catch {
            sent = false;
          }
        }
        if (!sent && MagicHardware?.sendIrKey && !irMissing) {
          sent = await MagicHardware.sendIrKey(key).catch(() => false);
        }
        return sent;
    },
    [
      activeDevice,
      sendTvShellCommand,
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
      if (!/^[A-Za-z0-9_.]+$/.test(pkg)) {
        showFeedback(t('invalidPackage'));
        return;
      }
      let launched = false;
      if (activeDevice?.transport === 'wifi') {
        launched = await sendTvShellCommand(
          `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`,
        );
      }
      if (!launched && activeDevice) {
        const result = await sendCommandToTv(
          activeDevice,
          { type: 'launch_app', packageName: pkg },
          300,
        ).catch(() => ({ ok: false }));
        launched = result.ok;
      }
      if (!launched && MagicHardware?.launchTvApp) {
        launched = await MagicHardware.launchTvApp(pkg).catch(() => false);
      }
      showFeedback(launched ? `${t('appLaunched')}: ${pkg}` : t('appsFetchFailed'));
    },
    [activeDevice, sendTvShellCommand, showFeedback, t],
  );

  const handleOpenTvUrl = useCallback(async () => {
    const url = shareUrlInput.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      showFeedback(t('invalidUrl'));
      return;
    }
    const escaped = url.replace(/'/g, `'\\''`);
    const opened = await sendTvShellCommand(
      `am start -a android.intent.action.VIEW -d '${escaped}'`,
    );
    showFeedback(opened ? `${t('openLink')}: ${url}` : t('textFailed'));
    if (opened) {
      setShareUrlInput('');
      setShareModalVisible(false);
      Keyboard.dismiss();
    }
  }, [sendTvShellCommand, shareUrlInput, showFeedback, t]);

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
      const shellText = text
        .replace(/\r?\n/g, '%s')
        .replace(/ /g, '%s')
        .replace(/'/g, `'\\''`);
      sent = await sendTvShellCommand(`input text '${shellText}'`, 600);
    }
    setSendingText(false);
    showFeedback(sent ? `${t('textSent')}: ${text}` : t('textFailed'));
    if (sent) {
      await handleSendKey('enter');
      setTvTextInput('');
      Keyboard.dismiss();
      setTextModalVisible(false);
    }
  }, [activeDevice, handleSendKey, sendTvShellCommand, showFeedback, t, tvTextInput]);

  const handleVoiceSearch = useCallback(async () => {
    tap();
    const [searchOpened, searchSent] = await Promise.all([
      sendTvShellCommand('am start -a android.search.action.GLOBAL_SEARCH').catch(
        () => false,
      ),
      handleSendKey('search').catch(() => false),
    ]);
    if (!searchOpened && !searchSent) showFeedback(t('voiceUnavailable'));
  }, [handleSendKey, sendTvShellCommand, showFeedback, t, tap]);

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
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      const sensitivity = Math.min(3, Math.max(0.2, state.mouseSensitivity || 1));
      pointerDeltaRef.current.x += dx * sensitivity;
      pointerDeltaRef.current.y += dy * sensitivity;
      if (pointerFlushRef.current != null) return;

      const isWifi = Boolean(activeDevice) && activeDevice?.transport !== 'bluetooth';
      pointerFlushRef.current = setTimeout(() => {
        pointerFlushRef.current = null;
        const pending = pointerDeltaRef.current;
        const moveX = Math.round(pending.x);
        const moveY = Math.round(pending.y);
        if (moveX === 0 && moveY === 0) return;
        pointerDeltaRef.current = {
          x: pending.x - moveX,
          y: pending.y - moveY,
        };

        if (!isWifi) {
          if (MagicHardware?.sendMouseMove) {
            void MagicHardware.sendMouseMove(moveX, moveY).catch(() => {});
          }
          return;
        }

        const STEP = 12;
        const horizontal = Math.abs(moveX) >= Math.abs(moveY);
        const key: 'up' | 'down' | 'left' | 'right' = horizontal
          ? moveX > 0 ? 'right' : 'left'
          : moveY > 0 ? 'down' : 'up';
        const amount = horizontal ? Math.abs(moveX) : Math.abs(moveY);
        if (amount < STEP) {
          pointerDeltaRef.current.x += moveX;
          pointerDeltaRef.current.y += moveY;
          return;
        }

        if (horizontal) {
          pointerDeltaRef.current.x += moveX > 0 ? -STEP : STEP;
        } else {
          pointerDeltaRef.current.y += moveY > 0 ? -STEP : STEP;
        }

        void handleSendKey(key).then((sent) => {
          if (sent) return;
          const code = KEYCODE_MAP[key]?.androidKeyCode;
          if (typeof code === 'number') {
            void sendTvShellCommand(`input keyevent ${code}`);
          }
        });
      }, isWifi ? 45 : 20);
    },
    [activeDevice, handleSendKey, sendTvShellCommand, state.mouseSensitivity],
  );

  const handleTouchpadPress = useCallback(async () => {
    tap();
    const isWifi = Boolean(activeDevice) && activeDevice?.transport !== 'bluetooth';
    if (isWifi) {
      const sent = await handleSendKey('ok');
      if (!sent) {
        const code = KEYCODE_MAP.ok.androidKeyCode;
        await sendTvShellCommand(`input keyevent ${code}`).catch(() => false);
      }
      return;
    }
    if (MagicHardware?.sendMouseClick) {
      void MagicHardware.sendMouseClick('left').catch(() => {});
    }
  }, [activeDevice, handleSendKey, sendTvShellCommand, tap]);

  const handleScroll = useCallback(
    (deltaY: number) => {
      if (!mouseScrollThrottleRef.current()) return;
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
    (mode: RemoteMouseMode) => {
      if (mode === 'air' && !airSupported) {
        showFeedback(t('airUnavailable'));
        return;
      }
      tap();
      setMouseMode(mode);
      setAirStatus(mode === 'air' ? t('airMouse') : t('airOff'));
      showFeedback(
        mode === 'air' ? t('airOn') : mode === 'swipe' ? t('swipeMode') : t('pointerMode'),
      );
    },
    [airSupported, showFeedback, t, tap],
  );

  const handleMouseSwipe = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      const key =
        direction === 'up'
          ? 'up'
          : direction === 'down'
            ? 'down'
            : direction === 'left'
              ? 'left'
              : 'right';
      handleSendKey(key);
    },
    [handleSendKey],
  );

  const handleMouseConfirm = useCallback(() => {
    handleSendKey('ok');
  }, [handleSendKey]);

  const handleToggleScrollInverted = useCallback(() => {
    tap();
    setScrollInverted((value) => !value);
  }, [tap]);

  const mouseController: RemoteMouseController = useMemo(
    () => ({
      mode: mouseMode,
      setMode: handleSetMouseMode,
      pointerSupported,
      airSupported,
      pointerStatus,
      airStatus,
      sensitivity: state.mouseSensitivity,
      scrollInverted,
      onToggleScrollInverted: handleToggleScrollInverted,
      onTouchpadDelta: handleTouchpadDelta,
      onTouchpadPress: handleTouchpadPress,
      onRightClick: handleRightClick,
      onRecenter: handleRecenter,
      onScroll: handleScroll,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onSwipe: handleMouseSwipe,
      onConfirm: handleMouseConfirm,
    }),
    [
      mouseMode,
      scrollInverted,
      handleToggleScrollInverted,
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
      handleMouseSwipe,
      handleMouseConfirm,
    ],
  );
  useEffect(() => {
    if (mouseMode !== 'air' || !airSupported) return;
    let mounted = true;
    Gyroscope.setUpdateInterval(60);
    const subscription = Gyroscope.addListener(({ x, y }) => {
      if (!mounted || !airMoveThrottleRef.current()) return;
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
  }, [mouseMode, airSupported, handleTouchpadDelta, state.mouseSensitivity]);

  const handleScanNetwork = useCallback(async () => {
    setScanning(true);
    setDiscoveredDevices([]);
    setScanProgressText(t('scanningNetwork'));

    try {
      const found: SavedDevice[] = [];
      const seen = new Set<string>();
      const localIp = await Network.getIpAddressAsync().catch(() => null);
      const prefix = getSubnetPrefix(localIp) ?? '192.168.1';
      const gateway = `${prefix}.1`;

      if (MagicHardware?.discoverNetworkDevices) {
        try {
          const nativeDevices = await MagicHardware.discoverNetworkDevices();
          for (const item of nativeDevices ?? []) {
            const reportedName = item.name?.trim() ?? '';
            if (
              !isValidIpv4(item.ip) ||
              item.ip === gateway ||
              isRouterishName(reportedName) ||
              seen.has(item.ip)
            ) {
              continue;
            }
            seen.add(item.ip);
            const port = Number(item.port) || 5555;
            const identity = await resolveDeviceIdentity({
              id: 'pending',
              name: reportedName,
              ip: item.ip,
              port,
              protocol: 'http',
              transport: 'wifi',
            });
            found.push({
              id: `discover-${item.ip}-${Date.now()}-${found.length}`,
              name: identity?.name || reportedName || `Android TV (${item.ip})`,
              ip: item.ip,
              port,
              protocol: 'http',
              transport: 'wifi',
              source: item.source ?? 'mDNS/SSDP',
              model: identity?.model ?? item.source,
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
          .filter((ip) => ip !== gateway && !seen.has(ip));
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
              name: item.res.name && !isRouterishName(item.res.name)
                ? item.res.name
                : `Android TV (${item.ip})`,
              ip: item.ip,
              port: item.res.port ?? 5555,
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
  }, [resolveDeviceIdentity, t]);

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
          (list ?? [])
            .filter((item) => Boolean(item.address?.trim()))
            .map((item, idx) => ({
              name: item.name?.trim() || `BT Device ${idx + 1}`,
              address: item.address!.trim(),
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

  const handleSaveManualDevice = useCallback(async () => {
    const cleanIp = manualIp.trim();
    const parsedPort = Number(manualPort.trim()) || 5555;
    const cleanMac = manualBtMac.trim().toUpperCase();

    if (manualTransport === 'wifi' && !isValidIpv4(cleanIp)) {
      Alert.alert(t('invalidIp'), t('invalidIpHelp'));
      return;
    }
    if (parsedPort < 1 || parsedPort > 65535) {
      Alert.alert(t('invalidPort'), t('invalidPortHelp'));
      return;
    }
    if (
      manualTransport === 'bluetooth' &&
      !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(cleanMac)
    ) {
      Alert.alert(t('invalidMac'), t('invalidMacHelp'));
      return;
    }

    const duplicate = state.devices.find((device) =>
      manualTransport === 'bluetooth'
        ? device.bluetoothMac?.toUpperCase() === cleanMac
        : device.ip === cleanIp && device.port === parsedPort,
    );
    if (duplicate) {
      setDeviceModalVisible(false);
      connectToDevice(duplicate);
      return;
    }

    let name = manualName.trim() || 'Magic A200 Pro';
    let model: string | undefined;
    if (manualTransport === 'wifi') {
      const identity = await resolveDeviceIdentity({
        id: 'pending',
        name,
        ip: cleanIp,
        port: parsedPort,
        protocol: manualProtocol,
        transport: 'wifi',
      });
      if (identity) {
        name = identity.name;
        model = identity.model;
      }
    }

    const newDevice: SavedDevice = {
      id: `dev-${Date.now()}`,
      name,
      ip: manualTransport === 'wifi' ? cleanIp : '0.0.0.0',
      port: parsedPort,
      protocol: manualProtocol,
      transport: manualTransport,
      bluetoothMac: manualTransport === 'bluetooth' ? cleanMac : undefined,
      model,
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
    connectToDevice,
    manualBtMac,
    manualIp,
    manualName,
    manualPort,
    manualProtocol,
    manualTransport,
    resolveDeviceIdentity,
    state.devices,
    t,
  ]);

  const handleAddDiscoveredDevice = useCallback(
    (dev: SavedDevice) => {
      const match = state.devices.find((item) =>
        dev.transport === 'bluetooth'
          ? Boolean(dev.bluetoothMac) &&
            item.bluetoothMac?.toUpperCase() === dev.bluetoothMac?.toUpperCase()
          : item.ip === dev.ip && item.port === dev.port,
      );
      const stored = match ?? dev;
      setState((prev) => ({
        ...prev,
        devices: match
          ? prev.devices.map((item) =>
              item.id === match.id ? { ...item, ...dev, id: match.id } : item,
            )
          : [dev, ...prev.devices],
        activeDeviceId: stored.id,
      }));
      setDeviceModalVisible(false);
      connectToDevice(stored);
    },
    [connectToDevice, state.devices],
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
    if (!activeDevice) {
      showFeedback(t('appsFetchFailed'));
      return;
    }
    setFetchingApps(true);
    try {
      let packages: string[] = [];
      if (activeDevice.transport === 'wifi' && MagicHardware?.getInstalledTvAppsFromHost) {
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
      onPressIn={tap}
            accessibilityRole="button"
            accessibilityLabel={t('settings')}
            onPress={() => setSettingsModalVisible(true)}
            style={[
              styles.iconButton,
              { backgroundColor: colors.cardAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="settings-outline" size={19} color={accent} />
          </Pressable>

          {connectionStatus === 'connected' && activeDevice ? (
            <Pressable
      onPressIn={tap}
              accessibilityRole="button"
              accessibilityLabel={t('apps')}
              onPress={handleFetchInstalledApps}
              style={[
                styles.iconButton,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: accent,
                },
              ]}
            >
              <Ionicons name="add-outline" size={21} color={accent} />
            </Pressable>
          ) : null}
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
            onOpenKeyboard={() => setTextModalVisible(true)}
            onOpenApps={handleFetchInstalledApps}
            onVoiceSearch={handleVoiceSearch}
            onTvSettings={() => {
              void handleSendKey('settings');
            }}
            onOpenShare={() => setShareModalVisible(true)}
            t={t}
            colors={colors}
            isConnected={connectionStatus === 'connected'}
            deviceName={activeDevice?.name ?? 'Magic A200 Pro'}
            mouse={mouseController}
            onPressFeedback={tap}
          />
        ) : screen === 'ac' ? (
          <AcPanel
            colors={colors}
            t={t}
            language={state.language}
            onPressFeedback={tap}
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
            language={state.language}
            onPressFeedback={tap}
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
            onSaveRoom={handleSaveRoom}
            onActivateRoom={handleActivateRoom}
            onDeleteRoom={(id) =>
              setState((prev) => ({
                ...prev,
                rooms: prev.rooms.filter((room) => room.id !== id),
                activeRoomId: prev.activeRoomId === id ? null : prev.activeRoomId,
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
              <Pressable onPressIn={tap} onPress={() => setDeviceModalVisible(false)}>
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
        animationType="slide"
        transparent
        onRequestClose={() => setTextModalVisible(false)}
      >
        <View style={styles.fullScreenModal}>
          <View style={styles.fullScreenHeader}>
            <Text style={[styles.fullScreenTitle, { color: accent }]}>
              {t('textTitle')}
            </Text>
            <Pressable
      onPressIn={tap}
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
              onPress={() => {
                Keyboard.dismiss();
                setTextModalVisible(false);
              }}
            >
              <Ionicons name="close" size={30} color={accent} />
            </Pressable>
          </View>

          <TextInput
            value={tvTextInput}
            onChangeText={setTvTextInput}
            placeholder={t('textPlaceholder')}
            placeholderTextColor="#5F7D73"
            autoFocus
            multiline
            returnKeyType="send"
            onSubmitEditing={() => {
              void handleSendTvText();
            }}
            style={[
              styles.fullScreenInput,
              {
                borderColor: accent,
                color: '#E9FFF7',
              },
            ]}
          />

          <Text style={[styles.fullScreenHint, { color: accent }]}>
            {t('textPlaceholder')}
          </Text>

          <View style={styles.modalFooterRow}>
            <Pressable
      onPressIn={tap}
              onPress={() => {
                Keyboard.dismiss();
                setTextModalVisible(false);
              }}
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: '#0C1714', borderColor: accent },
              ]}
            >
              <Text style={[styles.secondaryActionText, { color: accent }]}>
                {t('cancel')}
              </Text>
            </Pressable>

            <Pressable
      onPressIn={tap}
              onPress={() => {
                void handleSendTvText();
              }}
              disabled={sendingText}
              style={[styles.primaryActionBtn, { backgroundColor: accent }]}
            >
              <Text style={styles.primaryActionText}>
                {sendingText ? t('sending') : t('sendText')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={shareModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setShareModalVisible(false)}
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
                {t('share')}
              </Text>
              <Pressable
      onPressIn={tap}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                onPress={() => {
                  Keyboard.dismiss();
                  setShareModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={[styles.emptyHint, { color: colors.secondary }]}>
              {t('shareHelp')}
            </Text>

            <TextInput
              value={shareUrlInput}
              onChangeText={setShareUrlInput}
              placeholder={t('urlPlaceholder')}
              placeholderTextColor={colors.secondary}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onSubmitEditing={() => {
                void handleOpenTvUrl();
              }}
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
      onPressIn={tap}
                onPress={() => {
                  Keyboard.dismiss();
                  setShareModalVisible(false);
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
      onPressIn={tap}
                onPress={() => {
                  void handleOpenTvUrl();
                }}
                style={[styles.primaryActionBtn, { backgroundColor: accent }]}
              >
                <Ionicons name="globe-outline" size={18} color="#081012" />
                <Text style={styles.primaryActionText}>{t('openLink')}</Text>
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
              <Pressable onPressIn={tap} onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.settingsGroup}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('language')}
                </Text>
                <View style={styles.sensitivityBtnsRow}>
                  {(['ar', 'en'] as Language[]).map((value) => (
                    <Pressable
      onPressIn={tap}
                      key={value}
                      accessibilityRole="button"
                      onPress={() => setState((prev) => ({ ...prev, language: value }))}
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor: state.language === value ? accent : colors.cardAlt,
                          borderColor: state.language === value ? accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetPillText,
                          { color: state.language === value ? '#081012' : colors.text },
                        ]}
                      >
                        {t(value === 'ar' ? 'arabic' : 'english')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.settingsGroup}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('appearance')}
                </Text>
                <View style={styles.sensitivityBtnsRow}>
                  {(['system', 'dark', 'light'] as AppearanceMode[]).map((value) => (
                    <Pressable
      onPressIn={tap}
                      key={value}
                      accessibilityRole="button"
                      onPress={() =>
                        setState((prev) => ({ ...prev, appearance: value }))
                      }
                      style={[
                        styles.presetPill,
                        {
                          backgroundColor:
                            state.appearance === value ? accent : colors.cardAlt,
                          borderColor:
                            state.appearance === value ? accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetPillText,
                          {
                            color:
                              state.appearance === value ? '#081012' : colors.text,
                          },
                        ]}
                      >
                        {t(value)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.settingsGroup}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('accent')}
                </Text>
                <View style={styles.settingsAccentRow}>
                  {ACCENT_THEMES.map((theme) => (
                    <Pressable
      onPressIn={tap}
                      key={theme.id}
                      accessibilityRole="button"
                      accessibilityLabel={theme.name[state.language]}
                      onPress={() => setState((prev) => ({ ...prev, accent: theme.id }))}
                      style={[
                        styles.settingsAccentSwatch,
                        {
                          backgroundColor: theme.value,
                          borderColor: state.accent === theme.id ? colors.text : colors.border,
                        },
                      ]}
                    >
                      {state.accent === theme.id ? (
                        <Ionicons name="checkmark" size={13} color="#081012" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
      onPressIn={tap}
                accessibilityRole="button"
                onPress={() =>
                  setState((prev) => ({ ...prev, hapticsEnabled: !prev.hapticsEnabled }))
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
      onPressIn={tap}
                accessibilityRole="button"
                onPress={() =>
                  setState((prev) => ({ ...prev, autoConnect: !prev.autoConnect }))
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

              <Pressable
      onPressIn={tap}
                accessibilityRole="button"
                onPress={() =>
                  setState((prev) => ({ ...prev, keepAwake: !prev.keepAwake }))
                }
                style={[
                  styles.settingToggleRow,
                  { backgroundColor: colors.input, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  {t('keepAwake')}
                </Text>
                <Text style={styles.settingValueAccent}>
                  {state.keepAwake ? t('enabled') : t('disabled')}
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
                    const active = Math.abs(state.mouseSensitivity - preset) < 0.08;
                    return (
                      <Pressable
      onPressIn={tap}
                        key={preset}
                        accessibilityRole="button"
                        onPress={() =>
                          setState((prev) => ({ ...prev, mouseSensitivity: preset }))
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

              <Pressable
      onPressIn={tap}
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
              <Pressable onPressIn={tap} onPress={() => setAddAppModalVisible(false)}>
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
      onPressIn={tap}
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
              <Pressable onPressIn={tap} onPress={() => setAppsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Pressable
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
      onPressIn={tap}
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
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 18,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  fullScreenInput: {
    flex: 1,
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 18,
    lineHeight: 26,
    textAlignVertical: 'top',
    backgroundColor: '#07120F',
  },
  fullScreenHint: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  settingsGroup: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingsAccentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  settingsAccentSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
