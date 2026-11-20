import React, { useEffect, useState } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FlatList,
  Modal,
  NativeEventEmitter,
  NativeModules,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RemoteExperience } from '../components/RemoteExperience';

const MagicControl = NativeModules.MagicControlModule || NativeModules.MagicControl;

const TV_APPS_LIST = [
  { id: 'yt', name: 'YouTube', pkg: 'com.google.android.youtube.tv', icon: 'logo-youtube', color: '#EF4444' },
  { id: 'cs', name: 'CloudStream', pkg: 'com.lagradost.cloudstream3', icon: 'cloud-outline', color: '#38BDF8' },
  { id: 'stremio', name: 'Stremio', pkg: 'com.stremio.one', icon: 'play-circle-outline', color: '#A855F7' },
  { id: 'kodi', name: 'Kodi', pkg: 'org.xbmc.kodi', icon: 'cube-outline', color: '#0EA5E9' },
  { id: 'netflix', name: 'Netflix', pkg: 'com.netflix.ninja', icon: 'film-outline', color: '#DC2626' },
  { id: 'shahid', name: 'Shahid', pkg: 'net.mbc.shahid', icon: 'tv-outline', color: '#10B981' },
  { id: 'iptv', name: 'Live TV / IPTV', pkg: 'com.nst.iptvsmarterstvbox', icon: 'radio-outline', color: '#F59E0B' },
  { id: 'settings', name: 'Android Settings', pkg: 'com.android.tv.settings', icon: 'settings-outline', color: '#94A3B8' },
];

interface TvBrandProfile {
  id: string;
  name: string;
  protocol: 'NEC' | 'SAMSUNG' | 'SONY';
  freq: number;
  address: string;
  keys: Record<string, string>;
}

const TV_BRANDS: TvBrandProfile[] = [
  {
    id: 'magic_a200', name: 'Magic A200', protocol: 'NEC', freq: 38000, address: '0xFE01',
    keys: {
      power: '0x14', mute: '0x0D', info: '0x1C', menu: '0x4D', settings: '0x4D',
      up: '0x16', down: '0x1A', left: '0x51', right: '0x50', ok: '0x13',
      back: '0x19', home: '0x11', volumeUp: '0x18', volumeDown: '0x10', voice: '0x42',
      num0: '0x00', num1: '0x01', num2: '0x02', num3: '0x03', num4: '0x04',
      num5: '0x05', num6: '0x06', num7: '0x07', num8: '0x08', num9: '0x09',
    },
  },
  {
    id: 'samsung', name: 'Samsung', protocol: 'SAMSUNG', freq: 38000, address: '0x0707',
    keys: {
      power: '0x02', mute: '0x0F', info: '0x1F', menu: '0x1A', settings: '0x1A',
      up: '0x60', down: '0x61', left: '0x65', right: '0x62', ok: '0x68',
      back: '0x58', home: '0x79', volumeUp: '0x07', volumeDown: '0x0B', voice: '0x68',
      num0: '0x11', num1: '0x04', num2: '0x05', num3: '0x06', num4: '0x08',
      num5: '0x09', num6: '0x0A', num7: '0x0C', num8: '0x0D', num9: '0x0E',
    },
  },
  {
    id: 'lg', name: 'LG', protocol: 'NEC', freq: 38000, address: '0xFB04',
    keys: {
      power: '0x08', mute: '0x09', info: '0xAA', menu: '0x43', settings: '0x43',
      up: '0x40', down: '0x41', left: '0x07', right: '0x06', ok: '0x44',
      back: '0x28', home: '0x7C', volumeUp: '0x02', volumeDown: '0x03', voice: '0x44',
      num0: '0x10', num1: '0x11', num2: '0x12', num3: '0x13', num4: '0x14',
      num5: '0x15', num6: '0x16', num7: '0x17', num8: '0x18', num9: '0x19',
    },
  },
  {
    id: 'sony', name: 'Sony', protocol: 'SONY', freq: 40000, address: '0x01',
    keys: {
      power: '0x15', mute: '0x14', info: '0x3A', menu: '0x60', settings: '0x60',
      up: '0x74', down: '0x75', left: '0x34', right: '0x33', ok: '0x65',
      back: '0x23', home: '0x60', volumeUp: '0x12', volumeDown: '0x13', voice: '0x65',
      num0: '0x09', num1: '0x00', num2: '0x01', num3: '0x02', num4: '0x03',
      num5: '0x04', num6: '0x05', num7: '0x06', num8: '0x07', num9: '0x08',
    },
  },
  {
    id: 'tcl', name: 'TCL', protocol: 'NEC', freq: 38000, address: '0xDF00',
    keys: {
      power: '0x1C', mute: '0x10', info: '0x0F', menu: '0x0A', settings: '0x0A',
      up: '0x1A', down: '0x1E', left: '0x1B', right: '0x1F', ok: '0x0D',
      back: '0x1D', home: '0x14', volumeUp: '0x18', volumeDown: '0x19', voice: '0x0D',
      num0: '0x00', num1: '0x01', num2: '0x02', num3: '0x03', num4: '0x04',
      num5: '0x05', num6: '0x06', num7: '0x07', num8: '0x08', num9: '0x09',
    },
  },
  {
    id: 'hisense', name: 'Hisense', protocol: 'NEC', freq: 38000, address: '0xBF00',
    keys: {
      power: '0x0D', mute: '0x0E', info: '0x16', menu: '0x14', settings: '0x14',
      up: '0x16', down: '0x17', left: '0x19', right: '0x18', ok: '0x15',
      back: '0x48', home: '0x49', volumeUp: '0x44', volumeDown: '0x43', voice: '0x15',
      num0: '0x00', num1: '0x01', num2: '0x02', num3: '0x03', num4: '0x04',
      num5: '0x05', num6: '0x06', num7: '0x07', num8: '0x08', num9: '0x09',
    },
  },
  {
    id: 'xiaomi', name: 'Xiaomi Box', protocol: 'NEC', freq: 38000, address: '0xFF00',
    keys: {
      power: '0x0C', mute: '0x0E', info: '0x12', menu: '0x13', settings: '0x13',
      up: '0x01', down: '0x02', left: '0x03', right: '0x04', ok: '0x05',
      back: '0x06', home: '0x07', volumeUp: '0x08', volumeDown: '0x09', voice: '0x0A',
      num0: '0x10', num1: '0x11', num2: '0x12', num3: '0x13', num4: '0x14',
      num5: '0x15', num6: '0x16', num7: '0x17', num8: '0x18', num9: '0x19',
    },
  },
  {
    id: 'starsat', name: 'StarSat / GX', protocol: 'NEC', freq: 38000, address: '0x7F80',
    keys: {
      power: '0x0A', mute: '0x0C', info: '0x1F', menu: '0x04', settings: '0x04',
      up: '0x00', down: '0x01', left: '0x03', right: '0x02', ok: '0x1F',
      back: '0x05', home: '0x04', volumeUp: '0x02', volumeDown: '0x03', voice: '0x1F',
      num0: '0x10', num1: '0x11', num2: '0x12', num3: '0x13', num4: '0x14',
      num5: '0x15', num6: '0x16', num7: '0x17', num8: '0x18', num9: '0x19',
    },
  },
];

function buildIrPattern(profile: TvBrandProfile, commandHex: string): number[] {
  const cmd = parseInt(commandHex, 16) & 0xff;
  const addr16 = parseInt(profile.address, 16) & 0xffff;
  if (profile.protocol === 'SONY') {
    const addr = addr16 & 0x1f;
    const pattern = [2400, 600];
    for (let i = 0; i < 7; i++) pattern.push(((cmd >> i) & 1) ? 1200 : 600, 600);
    for (let i = 0; i < 5; i++) pattern.push(((addr >> i) & 1) ? 1200 : 600, 600);
    return pattern;
  }
  const lowAddr = addr16 & 0xff;
  const highAddr = (addr16 >> 8) & 0xff;
  const invCmd = (~cmd) & 0xff;
  const bytes = [lowAddr, highAddr, cmd, invCmd];
  const pattern = profile.protocol === 'SAMSUNG' ? [4500, 4500] : [9000, 4500];
  for (const b of bytes) {
    for (let i = 0; i < 8; i++) {
      const bit = (b >> i) & 1;
      pattern.push(562, bit === 1 ? 1687 : 562);
    }
  }
  pattern.push(562);
  return pattern;
}

export default function HomeScreen() {
  const [bottomTab, setBottomTab] = useState<'remote' | 'connections' | 'ac'>('remote');
  const [remotePage, setRemotePage] = useState<'remote' | 'mouse'>('remote');
  const [mouseMode, setMouseMode] = useState<'touchpad' | 'air'>('touchpad');
  const [sensitivity, setSensitivity] = useState(1.2);
  const [selectedTvBrandId, setSelectedTvBrandId] = useState<string>('magic_a200');
  const activeTvBrand = TV_BRANDS.find((b) => b.id === selectedTvBrandId) || TV_BRANDS[0];

  const [connectedName, setConnectedName] = useState<string | null>(null);
  const [connectedType, setConnectedType] = useState<'Bluetooth' | 'Wi-Fi' | 'Infrared' | null>(null);
  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiDevices, setWifiDevices] = useState<{ name: string; ip: string }[]>([]);
  const [wifiIp, setWifiIp] = useState('192.168.0.109');
  const [btScanning, setBtScanning] = useState(false);
  const [btDevices, setBtDevices] = useState<{ name: string; address: string }[]>([]);
  const [irTarget, setIrTarget] = useState<'satellite' | 'ac'>('satellite');
  const [customKeyMap, setCustomKeyMap] = useState<Record<string, string>>({});
  const [necModalOpen, setNecModalOpen] = useState(false);
  const [appsModalOpen, setAppsModalOpen] = useState(false);

  const [acPower, setAcPower] = useState(false);
  const [acTemp, setAcTemp] = useState(24);
  const LAST_TV_IP_KEY = "@magic_tv_last_ip";
  useEffect(() => { (async () => { try { const savedIp = await AsyncStorage.getItem(LAST_TV_IP_KEY); if (savedIp && savedIp.trim().length >= 7) { const clean = savedIp.trim(); setWifiIp(clean); MagicControl?.connectTvIp?.(clean).catch(() => {}); MagicControl?.sendTvKey?.(clean, "ping").catch(() => {}); } } catch (_e) {} })(); }, []);
  useEffect(() => { if (wifiIp && wifiIp.trim().length >= 7) { AsyncStorage.setItem(LAST_TV_IP_KEY, wifiIp.trim()).catch(() => {}); } }, [wifiIp]);
  const dispatchAcIrSignal = (tag = "ac") => { const freq = 38000; const pattern = tag === "power" ? "9000,4500,560,1690,560,560" : "9000,4500,560,560,560,1690"; MagicControl?.sendIrCode?.(freq, pattern).catch(() => {}); };
  const sendIrRaw = (freq = 38000, pattern = "9000,4500,560,560") => MagicControl?.sendIrCode?.(freq, pattern).catch(() => {});
  const openTvOnlySettings = () => { const ip = (wifiIp || "192.168.0.109").trim(); MagicControl?.sendTvKey?.(ip, "settings").catch(() => {}); MagicControl?.launchTvAppOnIp?.(ip, "com.android.tv.settings").catch(() => {}); MagicControl?.launchTvAppOnIp?.(ip, "com.android.settings").catch(() => {}); };
  const [tvMouseMode, setTvMouseMode] = useState(false);
  const [tvMicMode, setTvMicMode] = useState(false);
  const triggerTvMouse = () => { const next = !tvMouseMode; setTvMouseMode(next); MagicControl?.sendTvKey?.(wifiIp || "192.168.0.109", "mouse").catch(() => {}); MagicControl?.sendBluetoothKey?.("mouse").catch(() => {}); };
  const triggerTvMic = () => { const next = !tvMicMode; setTvMicMode(next); MagicControl?.sendTvKey?.(wifiIp || "192.168.0.109", "mic").catch(() => {}); MagicControl?.sendBluetoothKey?.("mic").catch(() => {}); };
  const [tvInstalledApps, setTvInstalledApps] = useState<Array<{ pkg: string; label: string }>>([]);
  const [loadingTvApps, setLoadingTvApps] = useState(false);
  const openConnectedTvApps = async () => { if (!wifiIp || wifiIp.trim().length < 7) { if (typeof setStatusMessage === "function") setStatusMessage("Connect to TV or TV Box first to view apps"); return; } setAppsModalOpen(true); setLoadingTvApps(true); try { const res = await MagicControl?.getInstalledTvApps?.(wifiIp.trim()); setTvInstalledApps(Array.isArray(res) ? res : []); } catch (_e) { setTvInstalledApps([]); } finally { setLoadingTvApps(false); } };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [accentColor, setAccentColor] = useState('#7CE3C3');

  const ACCENT_PALETTE = [
    { id: 'mint', color: '#7CE3C3', ar: 'فيروزي نعناعي', en: 'Mint' },
    { id: 'sky', color: '#38BDF8', ar: 'أزرق سماوي', en: 'Sky Blue' },
    { id: 'emerald', color: '#34D399', ar: 'أخضر زمردي', en: 'Emerald' },
    { id: 'purple', color: '#A78BFA', ar: 'بنفسجي ملكي', en: 'Royal Purple' },
    { id: 'gold', color: '#FBBF24', ar: 'ذهبي دافئ', en: 'Warm Gold' },
    { id: 'rose', color: '#FB7185', ar: 'وردي مرجاني', en: 'Coral Rose' },
  ];

  const isAr = lang === 'ar';
  const isDark = themeMode === 'dark';
  const ui = {
    bg: isDark ? '#0A1012' : '#F1F5F9',
    card: isDark ? '#11191C' : '#FFFFFF',
    cardAlt: isDark ? '#182629' : '#E2E8F0',
    border: isDark ? '#1D2B30' : '#CBD5E1',
    text: isDark ? '#F8FAFC' : '#0F172A',
    sub: isDark ? '#94A3B8' : '#475569',
  };
  const [acMode, setAcMode] = useState<'Auto' | 'Cool' | 'Heat' | 'Dry' | 'Fan'>('Auto');
  const [acFan, setAcFan] = useState<'Auto' | 'Low' | 'Medium' | 'High'>('Auto');
  const [acBrand, setAcBrand] = useState('Tosot');
  const [acSwing, setAcSwing] = useState(false);
  const [acTurbo, setAcTurbo] = useState(false);
  const [acSleep, setAcSleep] = useState(false);

  useEffect(() => {
    if (!MagicControl) return;
    const emitter = new NativeEventEmitter(MagicControl);
    const subBt = emitter.addListener('onBluetoothDeviceFound', (dev: any) => {
      if (dev?.address) {
        setBtDevices((prev) =>
          prev.some((d) => d.address === dev.address)
            ? prev
            : [...prev, { name: dev.name || 'MAGIC_A200', address: dev.address }]
        );
      }
    });
    const subWifi = emitter.addListener('onWifiDeviceFound', (dev: any) => {
      if (dev?.ip || dev?.host) {
        const ip = dev.ip || dev.host;
        setWifiDevices((prev) =>
          prev.some((d) => d.ip === ip) ? prev : [...prev, { name: dev.name || 'Android TV Box', ip }]
        );
      }
    });
    const subStatus = emitter.addListener('onConnectionStatus', (st: any) => {
      if (st?.status === 'connected') {
        setConnectedName(st.deviceName || 'MAGIC_A200');
        setConnectedType('Bluetooth');
      }
    });
    return () => { subBt.remove(); subWifi.remove(); subStatus.remove(); };
  }, []);

  useEffect(() => {
    if (!MagicControl) return;
    if (bottomTab === 'remote' && remotePage === 'mouse' && mouseMode === 'air') {
      MagicControl.startGyroscope?.().catch(() => {});
    } else {
      MagicControl.stopGyroscope?.();
    }
  }, [bottomTab, remotePage, mouseMode]);

  const handleSendKey = (key: string) => {
    const cmdHex = customKeyMap[key] || activeTvBrand.keys[key];
    if (cmdHex) {
      const pattern = buildIrPattern(activeTvBrand, cmdHex);
      MagicControl?.transmitIr?.(activeTvBrand.freq, pattern).catch(() => {});
    }
    MagicControl?.sendBluetoothKey?.(key).catch(() => {});
  };

  const handleDiscoverWifi = async () => {
    setWifiScanning(true);
    setWifiDevices([]);
    try {
      const info = await MagicControl?.getNetworkInfo?.();
      if (info?.ip && MagicControl?.scanWifiDevices) {
        const parts = String(info.ip).split(".");
        if (parts.length === 4) {
          const prefix = parts.slice(0, 3).join(".");
          const scanned = await MagicControl.scanWifiDevices(prefix).catch(() => []);
          if (Array.isArray(scanned) && scanned.length > 0 && typeof setDiscoveredDevices === "function") {
            setDiscoveredDevices(scanned);
          }
        }
      }
      const myIp: string = info?.ip || "";
      const ssid: string = info?.ssid || "Wi-Fi Network";
      if (!myIp || !myIp.includes(".")) {
        setWifiScanning(false);
        return;
      }
      const subnet = myIp.split(".").slice(0, 3).join(".");
      if (!wifiIp) setWifiIp(subnet + ".");
      const found: Array<{ name: string; ip: string }> = [];
      const ports = [8008, 8080, 5555, 80];
      const probe = async (ip: string) => {
        if (ip === myIp) return;
        for (const port of ports) {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 350);
          try {
            await fetch("http://" + ip + ":" + port, { signal: ctrl.signal });
            found.push({ name: ssid + " • Device (" + ip + ")", ip });
            setWifiDevices([...found]);
            clearTimeout(t);
            return;
          } catch (e: any) {
            clearTimeout(t);
            if (e?.name !== "AbortError" && String(e?.message || "").includes("Failed to connect")) {
              found.push({ name: ssid + " • Device (" + ip + ")", ip });
              setWifiDevices([...found]);
              return;
            }
          }
        }
      };
      const allIps = Array.from({ length: 254 }, (_, i) => subnet + "." + (i + 1));
      for (let i = 0; i < allIps.length; i += 32) {
        await Promise.all(allIps.slice(i, i + 32).map(probe));
      }
    } finally {
      setWifiScanning(false);
    }
  };

  const handleConnectIp = (targetIp = wifiIp) => {
    if (!targetIp.trim()) return;
    MagicControl?.resolveHostName?.(targetIp.trim()).catch(() => {});
    setConnectedName(`TV Box (${targetIp.trim()})`);
    setConnectedType('Wi-Fi');
  };

  const handleScanBt = async () => {
    setBtScanning(true);
    setBtDevices([]);
    try {
      const { PermissionsAndroid, Platform } = require("react-native");
      if (Platform.OS === "android") {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      }
      await MagicControl?.startBluetoothScan?.();
    } catch (_) {}
    setTimeout(() => setBtScanning(false), 6000);
  };

  const handlePairBt = (dev: { name: string; address: string }) => {
    setConnectedName(dev.name);
    setConnectedType('Bluetooth');
    MagicControl?.pairBluetoothDevice?.(dev.address).catch(() => {});
  };

  const handleSendAcIr = (newTemp = acTemp, newPower = acPower) => {
    setAcTemp(newTemp);
    setAcPower(newPower);
    const brandKey = String(acBrand || "").toLowerCase();
    const modeKey = String(acMode || "").toLowerCase();
    const brandHeader = brandKey.includes("tosot") || brandKey.includes("yac")
      ? [9000, 4500]
      : brandKey.includes("hafez") || brandKey.includes("حافظ")
      ? [8800, 4400]
      : brandKey.includes("midea")
      ? [4400, 4400]
      : brandKey.includes("lg")
      ? [8500, 4200]
      : brandKey.includes("samsung")
      ? [8900, 4500]
      : brandKey.includes("toshiba")
      ? [8600, 4300]
      : [9000, 4500];
    const modeCode = modeKey.includes("cool") ? 1 : modeKey.includes("heat") ? 2 : modeKey.includes("dry") ? 3 : modeKey.includes("fan") ? 4 : 0;
    const fanCode = String(acFan || "").toLowerCase().includes("high") ? 3 : String(acFan || "").toLowerCase().includes("med") ? 2 : String(acFan || "").toLowerCase().includes("low") ? 1 : 0;
    const tempCode = Math.max(0, Math.min(15, Number(newTemp) - 16));
    const bits = [
      newPower ? 1 : 0,
      ...tempCode.toString(2).padStart(4, "0").split("").map(Number),
      ...modeCode.toString(2).padStart(3, "0").split("").map(Number),
      ...fanCode.toString(2).padStart(2, "0").split("").map(Number),
    ];
    const pattern = [...brandHeader];
    bits.forEach((b) => pattern.push(580, b === 1 ? 1660 : 560));
    pattern.push(580);
    MagicControl?.transmitIr?.(38000, pattern).catch(() => {});
    MagicControl?.sendIrCode?.(38000, pattern.join(",")).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: ui.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={ui.bg} />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}><Ionicons name="tv-outline" size={18} color={accentColor} /></View>
          <Text style={[styles.appTitle, { color: ui.text }]}>{isAr ? 'ريموت ماجيك الذكي' : 'Magic Remote TV'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={[styles.plusBtn, { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border }]}
          >
            <Ionicons name="settings-outline" size={20} color={accentColor} />
          </Pressable>
          <Pressable onPress={() => openConnectedTvApps()} style={[styles.plusBtn, { backgroundColor: accentColor }]}>
            <Ionicons name="add" size={24} color="#0A1012" />
          </Pressable>
        </View>
      </View>

      <Pressable onPress={() => setBottomTab('connections')} style={[styles.statusBanner, { backgroundColor: ui.card, borderColor: ui.border }]}>
        <View style={[styles.statusDot, connectedName ? styles.dotGreen : styles.dotAmber]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: ui.text }]}>
            {connectedName ? `${connectedType} device` : `IR Ready · ${activeTvBrand.name}`}
          </Text>
          <Text style={[styles.statusSub, { color: ui.sub }]}>
            {connectedName
              ? `${connectedType} · Connected to ${connectedName}`
              : `${activeTvBrand.protocol} (${activeTvBrand.address}) · Tap to pair BT/Wi-Fi`}
          </Text>
        </View>
        <View style={[styles.statusCheck, connectedName && styles.statusCheckActive]}>
          {connectedName && <Ionicons name="checkmark" size={14} color="#0A1012" />}
        </View>
      </Pressable>

      <View style={{ flex: 1 }}>
        {bottomTab === 'remote' && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandPillsScroll}>
                {TV_BRANDS.map((b) => {
                  const active = selectedTvBrandId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => { setSelectedTvBrandId(b.id); setCustomKeyMap({}); }}
                      style={[styles.tvBrandPill, active && styles.tvBrandPillActive]}
                    >
                      <Text style={[styles.tvBrandPillText, active && styles.tvBrandPillTextActive]}>{b.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <RemoteExperience
              activeTab={remotePage}
              onTabChange={setRemotePage}
              onSendKey={handleSendKey}
              colors={{}}
              mouse={{
                mode: mouseMode, setMode: setMouseMode, pointerSupported: true, airSupported: true,
                sensitivity, setSensitivity,
                onTouchpadDelta: (dx, dy) => MagicControl?.sendBluetoothMouseMove?.(dx * sensitivity, dy * sensitivity).catch(() => {}),
                onTouchpadPress: () => MagicControl?.sendBluetoothMouseClick?.().catch(() => {}),
                onRightClick: () => MagicControl?.sendBluetoothKey?.('back').catch(() => {}),
                onRecenter: () => { MagicControl?.stopGyroscope?.(); setTimeout(() => MagicControl?.startGyroscope?.().catch(() => {}), 80); },
              }}
            />
          </View>
        )}

        {bottomTab === 'connections' && (
          <ScrollView contentContainerStyle={styles.connScrollBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionKicker}>DEVICE SETUP</Text>
            <Text style={styles.sectionHeading}>Connections</Text>
            <View style={styles.connCard}>
              <View style={styles.connCardHeader}>
                <View style={styles.connIconCircle}><Ionicons name="wifi" size={19} color={accentColor} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connCardTitle}>Wi-Fi</Text>
                  <Text style={styles.connCardSub}>Discover local TV and media services</Text>
                </View>
              </View>
              <Pressable onPress={handleDiscoverWifi} style={styles.mintPillBtn}>
                <Ionicons name="search" size={16} color="#0A1012" />
                <Text style={styles.mintPillBtnText}>{wifiScanning ? 'Discovering...' : 'Discover devices'}</Text>
              </Pressable>
              <Text style={styles.scanStateLabel}>{wifiScanning ? 'Scanning local subnet...' : wifiDevices.length > 0 ? `${wifiDevices.length} device(s) found` : 'Not scanned'}</Text>
              {wifiDevices.length === 0 ? (
                <View style={styles.emptyDiscoveryBox}><Ionicons name="search-outline" size={16} color="#94A3B8" /><Text style={styles.emptyDiscoveryText}>No devices discovered yet.</Text></View>
              ) : (
                wifiDevices.map((d) => (
                  <Pressable key={d.ip} onPress={() => handleConnectIp(d.ip)} style={styles.foundDeviceRow}>
                    <Ionicons name="tv-outline" size={18} color={accentColor} />
                    <View style={{ flex: 1 }}><Text style={styles.foundDeviceName}>{d.name}</Text><Text style={styles.foundDeviceSub}>{d.ip}</Text></View>
                    <Text style={styles.connectActionText}>Connect</Text>
                  </Pressable>
                ))
              )}
              <View style={styles.dividerLine} />
              <Text style={styles.subFieldLabel}>Manual IP connection</Text>
              <TextInput value={wifiIp} onChangeText={setWifiIp} placeholder="192.168.1.20" placeholderTextColor="#64748B" keyboardType="numeric" style={styles.manualIpField} />
              <Pressable onPress={() => handleConnectIp(wifiIp)} style={[styles.connectIpBtn, wifiIp.trim().length > 6 && styles.connectIpBtnActive]}>
                <Ionicons name="link-outline" size={16} color={wifiIp.trim().length > 6 ? '#0A1012' : '#4E7A6E'} />
                <Text style={[styles.connectIpBtnText, wifiIp.trim().length > 6 && { color: '#0A1012' }]}>Connect by IP</Text>
              </Pressable>
            </View>

            <View style={styles.connCard}>
              <View style={styles.connCardHeader}>
                <View style={styles.connIconCircle}><Ionicons name="bluetooth" size={19} color={accentColor} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connCardTitle}>Bluetooth</Text>
                  <Text style={styles.connCardSub}>Pair as a real remote-control device</Text>
                </View>
              </View>
              <Pressable onPress={handleScanBt} style={styles.mintWideBtn}>
                <Ionicons name="search" size={16} color="#0A1012" />
                <Text style={styles.mintPillBtnText}>{btScanning ? 'Scanning nearby...' : 'Scan nearby devices'}</Text>
              </Pressable>
              
              {btDevices.map((d) => (
                <Pressable key={d.address} onPress={() => handlePairBt(d)} style={styles.foundDeviceRow}>
                  <Ionicons name="bluetooth-outline" size={18} color={accentColor} />
                  <View style={{ flex: 1 }}><Text style={styles.foundDeviceName}>{d.name}</Text><Text style={styles.foundDeviceSub}>{d.address}</Text></View>
                  <Text style={styles.connectActionText}>Pair</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.connCard}>
              <View style={styles.connCardHeader}>
                <View style={styles.connIconCircle}><Ionicons name="radio-outline" size={19} color={accentColor} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connCardTitle}>Infrared</Text>
                  <Text style={styles.connCardSub}>Universal TV, Box & Satellite IR</Text>
                </View>
              </View>
              <View style={styles.irNoticeBox}>
                <View style={styles.dotGreen} />
                <Text style={styles.irNoticeText}>Active Brand: {activeTvBrand.name} · {activeTvBrand.protocol} ({activeTvBrand.address})</Text>
              </View>
              <View style={styles.necProfileRow}>
                {TV_BRANDS.map((b) => {
                  const active = selectedTvBrandId === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => { setSelectedTvBrandId(b.id); setCustomKeyMap({}); }} style={[styles.necChip, active && styles.necChipActive]}>
                      <Text style={[styles.necChipText, active && { color: '#7CE3C3' }]}>{b.name} · {b.address}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => setNecModalOpen(true)} style={styles.mintWideBtn}>
                <Ionicons name="options-outline" size={17} color="#0A1012" />
                <Text style={styles.mintPillBtnText}>Customize per-button codes</Text>
              </Pressable>
              <View style={styles.irUseRow}>
                <Pressable onPress={() => { setIrTarget('satellite'); setConnectedName(`${activeTvBrand.name} IR`); setConnectedType('Infrared'); setBottomTab('remote'); }} style={[styles.irUseBtn, irTarget === 'satellite' && styles.irUseBtnActive]}>
                  <Text style={[styles.irUseBtnText, irTarget === 'satellite' && { color: '#7CE3C3' }]}>Use TV / Box IR</Text>
                </Pressable>
                <Pressable onPress={() => { setIrTarget('ac'); setBottomTab('ac'); }} style={[styles.irUseBtn, irTarget === 'ac' && styles.irUseBtnActive]}>
                  <Text style={[styles.irUseBtnText, irTarget === 'ac' && { color: '#7CE3C3' }]}>Use Tosot AC IR</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        {bottomTab === 'ac' && (
          <ScrollView contentContainerStyle={styles.acScrollBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionKicker}>SPLIT AIR CONDITIONER</Text>
            <Text style={styles.sectionHeading}>Tosot AC</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandPillsScroll}>
              {['Tosot', 'Gree', 'LG', 'Samsung', 'Midea', 'Daikin', 'Carrier', 'TCL', 'Hisense'].map((b) => {
                const active = acBrand === b;
                return (
                  <Pressable key={b} onPress={() => { setAcBrand(b); handleSendAcIr(acTemp, acPower); }} style={[styles.acBrandPill, active && styles.acBrandPillActive]}>
                    <Text style={[styles.acBrandPillText, active && styles.acBrandPillTextActive]}>{b}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.irStateCard}>
              <View style={styles.irStateTopRow}>
                <Text style={styles.irStateHeader}>{acBrand.toUpperCase()} · IR COMMAND STATE</Text>
                <View style={[styles.irPowerBadge, acPower && styles.irPowerBadgeOn]}>
                  <Text style={[styles.irPowerBadgeText, acPower && { color: '#7CE3C3' }]}>{acPower ? 'ON' : 'OFF'}</Text>
                </View>
              </View>
              <View style={styles.irStateMidRow}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={styles.irTempValue}>{acTemp}</Text><Text style={styles.irTempUnit}>°C</Text></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={styles.irModeLabel}>{acMode}</Text><Text style={styles.irFanLabel}>FAN {acFan.toUpperCase()}</Text></View>
              </View>
              <Text style={styles.irDisclaimer}>Remote command values only; the air conditioner does not report back over IR.</Text>
            </View>
            <View style={styles.acPowerTempRow}>
              <Pressable onPress={() => handleSendAcIr(acTemp, !acPower)} style={styles.acMintPowerBtn}><Ionicons name="power" size={24} color="#0A1012" /></Pressable>
              <View style={styles.acTempCapsule}>
                <Pressable onPress={() => handleSendAcIr(Math.max(16, acTemp - 1), true)} style={styles.acStepCircle}><Ionicons name="remove" size={18} color="#CBD5E1" /></Pressable>
                <Text style={styles.acCapsuleTempText}>{acTemp}°C</Text>
                <Pressable onPress={() => handleSendAcIr(Math.min(30, acTemp + 1), true)} style={styles.acStepCircle}><Ionicons name="add" size={18} color="#CBD5E1" /></Pressable>
              </View>
            </View>
            <Text style={styles.acGroupLabel}>Mode</Text>
            <View style={styles.acGridRow}>
              {[{ label: 'Auto', icon: 'sync-outline' }, { label: 'Cool', icon: 'snow-outline' }, { label: 'Heat', icon: 'sunny-outline' }].map((m) => {
                const active = acMode === m.label;
                return (
                  <Pressable key={m.label} onPress={() => { setAcMode(m.label as any); handleSendAcIr(acTemp, true); }} style={[styles.acOptionTile, active && styles.acOptionTileActive]}>
                    <Ionicons name={m.icon as any} size={17} color={active ? accentColor : '#94A3B8'} />
                    <Text style={[styles.acOptionText, active && { color: '#E2E8F0' }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.acGridRow}>
              {[{ label: 'Dry', icon: 'water-outline' }, { label: 'Fan', icon: 'leaf-outline' }].map((m) => {
                const active = acMode === m.label;
                return (
                  <Pressable key={m.label} onPress={() => { setAcMode(m.label as any); handleSendAcIr(acTemp, true); }} style={[styles.acOptionTile, active && styles.acOptionTileActive]}>
                    <Ionicons name={m.icon as any} size={17} color={active ? accentColor : '#94A3B8'} />
                    <Text style={[styles.acOptionText, active && { color: '#E2E8F0' }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.acGroupLabel}>Fan speed</Text>
            <View style={styles.acFanRow}>
              {(['Auto', 'Low', 'Medium', 'High'] as const).map((f) => {
                const active = acFan === f;
                return (
                  <Pressable key={f} onPress={() => { setAcFan(f); handleSendAcIr(acTemp, true); }} style={[styles.acFanPill, active && styles.acFanPillActive]}>
                    <Text style={[styles.acFanPillText, active && { color: '#7CE3C3' }]}>{f}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.acExtrasRow}>
              <Pressable onPress={() => { setAcSwing(!acSwing); handleSendAcIr(acTemp, true); }} style={[styles.acExtraCard, acSwing && styles.acOptionTileActive]}><Ionicons name="swap-vertical-outline" size={20} color={acSwing ? accentColor : '#94A3B8'} /><Text style={styles.acExtraText}>Vertical swing</Text></Pressable>
              <Pressable onPress={() => { setAcTurbo(!acTurbo); handleSendAcIr(acTemp, true); }} style={[styles.acExtraCard, acTurbo && styles.acOptionTileActive]}><Ionicons name="flash-outline" size={20} color={acTurbo ? accentColor : '#94A3B8'} /><Text style={styles.acExtraText}>Turbo</Text></Pressable>
              <Pressable onPress={() => { setAcSleep(!acSleep); handleSendAcIr(acTemp, true); }} style={[styles.acExtraCard, acSleep && styles.acOptionTileActive]}><Ionicons name="moon-outline" size={20} color={acSleep ? accentColor : '#94A3B8'} /><Text style={styles.acExtraText}>Sleep</Text></Pressable>
            </View>
          </ScrollView>
        )}
      </View>

      <View style={[styles.bottomNav, { backgroundColor: ui.card, borderColor: ui.border }]}>
        <Pressable onPress={() => setBottomTab('remote')} style={[styles.navItem, bottomTab === 'remote' && { backgroundColor: ui.cardAlt, borderWidth: 1, borderColor: accentColor }]}>
          <Ionicons name="game-controller-outline" size={18} color={bottomTab === 'remote' ? accentColor : ui.sub} />
          <Text style={[styles.navText, { color: bottomTab === 'remote' ? accentColor : ui.sub }]}>{isAr ? 'الريموت' : 'Remote'}</Text>
        </Pressable>
        <Pressable onPress={() => setBottomTab('connections')} style={[styles.navItem, bottomTab === 'connections' && { backgroundColor: ui.cardAlt, borderWidth: 1, borderColor: accentColor }]}>
          <Ionicons name="git-network-outline" size={18} color={bottomTab === 'connections' ? accentColor : ui.sub} />
          <Text style={[styles.navText, { color: bottomTab === 'connections' ? accentColor : ui.sub }]}>{isAr ? 'الاتصال' : 'Connections'}</Text>
        </Pressable>
        <Pressable onPress={() => setBottomTab('ac')} style={[styles.navItem, bottomTab === 'ac' && { backgroundColor: ui.cardAlt, borderWidth: 1, borderColor: accentColor }]}>
          <Ionicons name="snow-outline" size={18} color={bottomTab === 'ac' ? accentColor : ui.sub} />
          <Text style={[styles.navText, { color: bottomTab === 'ac' ? accentColor : ui.sub }]}>{isAr ? 'السبلت' : 'Tosot AC'}</Text>
        </Pressable>
      </View>

      {/* Separate Settings Interface Modal */}
      <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <SafeAreaView style={[styles.safe, { backgroundColor: ui.bg }]}>
          <View style={[styles.header, { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: ui.border }]}>
            <View style={styles.brandRow}>
              <View style={[styles.logoBadge, { backgroundColor: ui.card, borderColor: ui.border }]}>
                <Ionicons name="settings" size={18} color={accentColor} />
              </View>
              <Text style={[styles.appTitle, { color: ui.text }]}>{isAr ? 'الإعدادات والمظهر' : 'Settings & Theme'}</Text>
            </View>
            <Pressable
              onPress={() => setSettingsOpen(false)}
              style={[styles.plusBtn, { backgroundColor: ui.card, borderWidth: 1, borderColor: ui.border }]}
            >
              <Ionicons name="close" size={22} color={ui.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
            {/* 1. Language Card */}
            <View style={[styles.connCard, { backgroundColor: ui.card, borderColor: ui.border }]}>
              <View style={styles.connCardHeader}>
                <View style={[styles.connIconCircle, { backgroundColor: ui.cardAlt, borderColor: ui.border }]}>
                  <Ionicons name="language-outline" size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connCardTitle, { color: ui.text }]}>{isAr ? 'اللغة' : 'Language'}</Text>
                  <Text style={[styles.connCardSub, { color: ui.sub }]}>{isAr ? 'اختر لغة واجهة التطبيق' : 'Choose application language'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={() => setLang('ar')}
                  style={{
                    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
                    backgroundColor: isAr ? accentColor : ui.cardAlt,
                    borderWidth: 1, borderColor: isAr ? accentColor : ui.border,
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 15, color: isAr ? '#0A1012' : ui.text }}>العربية</Text>
                </Pressable>
                <Pressable
                  onPress={() => setLang('en')}
                  style={{
                    flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center',
                    backgroundColor: !isAr ? accentColor : ui.cardAlt,
                    borderWidth: 1, borderColor: !isAr ? accentColor : ui.border,
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 15, color: !isAr ? '#0A1012' : ui.text }}>English</Text>
                </Pressable>
              </View>
            </View>

            {/* 2. Dark / Light Mode Card */}
            <View style={[styles.connCard, { backgroundColor: ui.card, borderColor: ui.border }]}>
              <View style={styles.connCardHeader}>
                <View style={[styles.connIconCircle, { backgroundColor: ui.cardAlt, borderColor: ui.border }]}>
                  <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connCardTitle, { color: ui.text }]}>{isAr ? 'وضع الإضاءة (المود)' : 'Display Mode'}</Text>
                  <Text style={[styles.connCardSub, { color: ui.sub }]}>{isAr ? 'التبديل بين الوضع الليلي والنهاري' : 'Switch between Dark and Light modes'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <Pressable
                  onPress={() => setThemeMode('dark')}
                  style={{
                    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
                    paddingVertical: 13, borderRadius: 14,
                    backgroundColor: isDark ? accentColor : ui.cardAlt,
                    borderWidth: 1, borderColor: isDark ? accentColor : ui.border,
                  }}
                >
                  <Ionicons name="moon" size={17} color={isDark ? '#0A1012' : ui.text} />
                  <Text style={{ fontWeight: '800', fontSize: 14, color: isDark ? '#0A1012' : ui.text }}>
                    {isAr ? 'الوضع الليلي' : 'Dark Mode'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setThemeMode('light')}
                  style={{
                    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7,
                    paddingVertical: 13, borderRadius: 14,
                    backgroundColor: !isDark ? accentColor : ui.cardAlt,
                    borderWidth: 1, borderColor: !isDark ? accentColor : ui.border,
                  }}
                >
                  <Ionicons name="sunny" size={17} color={!isDark ? '#0A1012' : ui.text} />
                  <Text style={{ fontWeight: '800', fontSize: 14, color: !isDark ? '#0A1012' : ui.text }}>
                    {isAr ? 'الوضع النهاري' : 'Light Mode'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 3. Beautiful Colors Card */}
            <View style={[styles.connCard, { backgroundColor: ui.card, borderColor: ui.border }]}>
              <View style={styles.connCardHeader}>
                <View style={[styles.connIconCircle, { backgroundColor: ui.cardAlt, borderColor: ui.border }]}>
                  <Ionicons name="color-palette-outline" size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.connCardTitle, { color: ui.text }]}>{isAr ? 'ألوان الواجهة' : 'Accent Colors'}</Text>
                  <Text style={[styles.connCardSub, { color: ui.sub }]}>{isAr ? 'اختر اللون المفضل للأزرار والإضاءة' : 'Select a highlight color for buttons'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                {ACCENT_PALETTE.map((item) => {
                  const selected = accentColor === item.color;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setAccentColor(item.color)}
                      style={{
                        width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14,
                        backgroundColor: selected ? ui.cardAlt : ui.bg,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? item.color : ui.border,
                      }}
                    >
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center' }}>
                        {selected && <Ionicons name="checkmark" size={15} color="#0A1012" />}
                      </View>
                      <Text style={{ color: ui.text, fontWeight: selected ? '800' : '600', fontSize: 13 }}>
                        {isAr ? item.ar : item.en}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={() => setSettingsOpen(false)}
              style={{ marginTop: 6, backgroundColor: accentColor, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#0A1012', fontWeight: '800', fontSize: 15 }}>
                {isAr ? 'حفظ والعودة للريموت' : 'Done & Back to Remote'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={appsModalOpen} transparent animationType="fade" onRequestClose={() => setAppsModalOpen(false)}>

        <View style={styles.modalBackdrop}>
          <View style={styles.appsModalCard}>
            <View style={styles.appsModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="apps" size={20} color={accentColor} />
                <View><Text style={styles.appsModalTitle}>TV apps</Text><Text style={styles.appsModalSub}>{connectedName ? `Launch on ${connectedName}` : 'Tap any app to open on TV Box'}</Text></View>
              </View>
              <Pressable onPress={() => setAppsModalOpen(false)} style={styles.closeModalBtn}><Ionicons name="close" size={18} color="#CBD5E1" /></Pressable>
            </View>
            <FlatList data={TV_APPS_LIST} keyExtractor={(item) => item.id} numColumns={2} columnWrapperStyle={{ gap: 10 }} contentContainerStyle={{ gap: 10, paddingTop: 12 }} renderItem={({ item }) => (
              <Pressable onPress={() => { MagicControl?.launchTvApp?.(item.pkg).catch(() => {}); setAppsModalOpen(false); }} style={styles.appTile}>
                <Ionicons name={item.icon as any} size={22} color={item.color} /><Text style={styles.appTileName}>{item.name}</Text>
              </Pressable>
            )} />
          </View>
        </View>
      </Modal>

      <Modal visible={necModalOpen} transparent animationType="slide" onRequestClose={() => setNecModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.appsModalCard, { maxHeight: '75%' }]}>
            <View style={styles.appsModalHeader}>
              <View><Text style={styles.appsModalTitle}>{activeTvBrand.name} Codes ({activeTvBrand.address})</Text><Text style={styles.appsModalSub}>Edit hex command per remote button</Text></View>
              <Pressable onPress={() => setNecModalOpen(false)} style={styles.closeModalBtn}><Ionicons name="close" size={18} color="#CBD5E1" /></Pressable>
            </View>
            <ScrollView style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
              {Object.entries(activeTvBrand.keys).map(([btnKey, defaultHex]) => (
                <View key={btnKey} style={styles.necEditRow}>
                  <Text style={styles.necEditLabel}>{btnKey.toUpperCase()}</Text>
                  <TextInput value={customKeyMap[btnKey] ?? defaultHex} onChangeText={(txt) => setCustomKeyMap((prev) => ({ ...prev, [btnKey]: txt }))} style={styles.necEditInput} />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A1012' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#132224', borderWidth: 1, borderColor: '#284E46', alignItems: 'center', justifyContent: 'center' },
  appTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  plusBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#7CE3C3', alignItems: 'center', justifyContent: 'center' },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotAmber: { backgroundColor: '#F59E0B' },
  dotGreen: { backgroundColor: '#7CE3C3' },
  statusTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  statusSub: { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  statusCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  statusCheckActive: { backgroundColor: '#7CE3C3', borderColor: '#7CE3C3' },
  tvBrandPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  tvBrandPillActive: { backgroundColor: '#7CE3C3', borderColor: '#7CE3C3' },
  tvBrandPillText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  tvBrandPillTextActive: { color: '#0A1012', fontWeight: '800' },
  bottomNav: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, marginTop: 4, padding: 5, borderRadius: 22, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  navItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 17 },
  navItemActive: { backgroundColor: '#182629', borderWidth: 1, borderColor: '#2B5349' },
  navText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  navTextActive: { color: '#7CE3C3', fontWeight: '700' },
  sectionKicker: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionHeading: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  connScrollBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 12 },
  connCard: { backgroundColor: '#11191C', borderRadius: 22, borderWidth: 1, borderColor: '#1D2B30', padding: 16, gap: 12 },
  connCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  connIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#152426', borderWidth: 1, borderColor: '#233B3E', alignItems: 'center', justifyContent: 'center' },
  connCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  connCardSub: { color: '#94A3B8', fontSize: 12 },
  mintPillBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#7CE3C3', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16 },
  mintWideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7CE3C3', paddingVertical: 13, borderRadius: 16 },
  mintPillBtnText: { color: '#0A1012', fontSize: 13, fontWeight: '700' },
  scanStateLabel: { color: '#94A3B8', fontSize: 12 },
  emptyDiscoveryBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: '#0E1518', borderWidth: 1, borderColor: '#1D2B30' },
  emptyDiscoveryText: { color: '#CBD5E1', fontSize: 13 },
  foundDeviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#152024', borderWidth: 1, borderColor: '#223338' },
  foundDeviceName: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  foundDeviceSub: { color: '#94A3B8', fontSize: 11 },
  connectActionText: { color: '#7CE3C3', fontSize: 13, fontWeight: '700' },
  dividerLine: { height: 1, backgroundColor: '#1D2B30', marginVertical: 2 },
  subFieldLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  manualIpField: { backgroundColor: '#0E1518', borderWidth: 1, borderColor: '#1D2B30', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#F8FAFC', fontSize: 14 },
  connectIpBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#1C3B36', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16 },
  connectIpBtnActive: { backgroundColor: '#7CE3C3' },
  connectIpBtnText: { color: '#4E7A6E', fontSize: 13, fontWeight: '700' },
  irNoticeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#0E1518', borderWidth: 1, borderColor: '#1D2B30' },
  irNoticeText: { color: '#CBD5E1', fontSize: 12, flex: 1, lineHeight: 17 },
  necProfileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  necChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, backgroundColor: '#0E1518', borderWidth: 1, borderColor: '#1D2B30' },
  necChipActive: { borderColor: '#7CE3C3', backgroundColor: '#152526' },
  necChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  irUseRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  irUseBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: '#162125', borderWidth: 1, borderColor: '#223238' },
  irUseBtnActive: { borderColor: '#7CE3C3', backgroundColor: '#152526' },
  irUseBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  acScrollBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, gap: 10 },
  brandPillsScroll: { gap: 8, paddingVertical: 2 },
  acBrandPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  acBrandPillActive: { backgroundColor: '#7CE3C3', borderColor: '#7CE3C3' },
  acBrandPillText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  acBrandPillTextActive: { color: '#0A1012', fontWeight: '800' },
  irStateCard: { backgroundColor: '#11191C', borderRadius: 22, borderWidth: 1, borderColor: '#1D2B30', padding: 16, gap: 10 },
  irStateTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  irStateHeader: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  irPowerBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: '#182226', borderWidth: 1, borderColor: '#25353B' },
  irPowerBadgeOn: { borderColor: '#2B594E', backgroundColor: '#142624' },
  irPowerBadgeText: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  irStateMidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  irTempValue: { color: '#F8FAFC', fontSize: 48, fontWeight: '800', lineHeight: 52 },
  irTempUnit: { color: '#94A3B8', fontSize: 20, fontWeight: '700', marginTop: 8, marginLeft: 2 },
  irModeLabel: { color: '#7CE3C3', fontSize: 17, fontWeight: '700' },
  irFanLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  irDisclaimer: { color: '#64748B', fontSize: 11, lineHeight: 15 },
  acPowerTempRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  acMintPowerBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#7CE3C3', alignItems: 'center', justifyContent: 'center' },
  acTempCapsule: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  acStepCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#162125', borderWidth: 1, borderColor: '#223238', alignItems: 'center', justifyContent: 'center' },
  acCapsuleTempText: { color: '#E2E8F0', fontSize: 16, fontWeight: '700' },
  acGroupLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '700', marginTop: 2 },
  acGridRow: { flexDirection: 'row', gap: 8 },
  acOptionTile: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 18, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  acOptionTileActive: { borderColor: '#7CE3C3', backgroundColor: '#152526' },
  acOptionText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  acFanRow: { flexDirection: 'row', gap: 8 },
  acFanPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  acFanPillActive: { borderColor: '#7CE3C3', backgroundColor: '#152526' },
  acFanPillText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  acExtrasRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  acExtraCard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 18, backgroundColor: '#11191C', borderWidth: 1, borderColor: '#1D2B30' },
  acExtraText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 },
  appsModalCard: { backgroundColor: '#131D20', borderRadius: 24, borderWidth: 1, borderColor: '#223338', padding: 16 },
  appsModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appsModalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  appsModalSub: { color: '#94A3B8', fontSize: 12 },
  closeModalBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C292D', alignItems: 'center', justifyContent: 'center' },
  appTile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#182428', borderWidth: 1, borderColor: '#24363C', borderRadius: 16, padding: 13 },
  appTileName: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  necEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#182428', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  necEditLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  necEditInput: { backgroundColor: '#0E1518', borderWidth: 1, borderColor: '#24363C', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, color: '#7CE3C3', fontSize: 12, width: 72, textAlign: 'center' },
});
