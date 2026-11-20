import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RemoteExperienceColors } from './RemoteExperience';
import { SavedDevice } from '../utils/device';
import { TranslationKey } from '../utils/i18n';
import { AccentId, AppearanceMode, ACCENT_THEMES, Language } from '../utils/theme';
import { RoomProfile } from '../utils/room';

interface ConnectionPanelProps {
  colors: RemoteExperienceColors;
  t: (key: TranslationKey) => string;
  devices: SavedDevice[];
  activeDeviceId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  scanning: boolean;
  scanProgressText: string;
  discoveredDevices: SavedDevice[];
  btDevices: Array<{ name: string; address: string; bondState?: string }>;
  btScanning: boolean;
  irMissing: boolean;
  pointerSupported: boolean;
  airSupported: boolean;
  hapticsEnabled: boolean;
  autoConnect: boolean;
  keepAwake: boolean;
  sensitivity: number;
  language: Language;
  appearance: AppearanceMode;
  accentId: AccentId;
  rooms: RoomProfile[];
  activeRoomId: string | null;
  tvBrand: string;
  tvCodeSet: 1 | 2 | 3;
  onConnect: (device: SavedDevice) => void;
  onDisconnect: () => void;
  onRemove: (id: string) => void;
  onScanNetwork: () => void;
  onScanBluetooth: () => void;
  onOpenManual: () => void;
  onToggleHaptics: () => void;
  onToggleAutoConnect: () => void;
  onToggleKeepAwake: () => void;
  onSensitivityChange: (value: number) => void;
  onLanguageChange: (language: Language) => void;
  onAppearanceChange: (appearance: AppearanceMode) => void;
  onAccentChange: (accent: AccentId) => void;
  onSaveRoom: () => void;
  onActivateRoom: (room: RoomProfile) => void;
  onDeleteRoom: (id: string) => void;
  onTvBrandChange: (brand: string) => void;
  onTvCodeSetChange: (codeSet: 1 | 2 | 3) => void;
}

export function ConnectionPanel({
  colors,
  t,
  devices,
  activeDeviceId,
  connectionStatus,
  scanning,
  scanProgressText,
  discoveredDevices,
  btDevices,
  btScanning,
  irMissing,
  pointerSupported,
  airSupported,
  hapticsEnabled,
  autoConnect,
  keepAwake,
  sensitivity,
  language,
  appearance,
  accentId,
  rooms,
  activeRoomId,
  tvBrand,
  tvCodeSet,
  onConnect,
  onDisconnect,
  onRemove,
  onScanNetwork,
  onScanBluetooth,
  onOpenManual,
  onToggleHaptics,
  onToggleAutoConnect,
  onToggleKeepAwake,
  onSensitivityChange,
  onLanguageChange,
  onAppearanceChange,
  onAccentChange,
  onSaveRoom,
  onActivateRoom,
  onDeleteRoom,
  onTvBrandChange,
  onTvCodeSetChange,
}: ConnectionPanelProps) {
  const active = devices.find((device) => device.id === activeDeviceId) ?? null;
  const accent = colors.accent;
  const statusLabel =
    connectionStatus === 'connected'
      ? t('connected')
      : connectionStatus === 'connecting'
        ? t('connecting')
        : t('disconnected');
  const statusColor =
    connectionStatus === 'connected'
      ? '#34D399'
      : connectionStatus === 'connecting'
        ? '#FBBF24'
        : '#F87171';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('connectionTitle')}</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>{t('connectionHelp')}</Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={styles.statusText}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {active ? active.name : t('noDevice')}
            </Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              {active
                ? active.transport === 'bluetooth'
                  ? `Bluetooth HID · ${active.bluetoothMac ?? t('connected')}`
                  : `${active.ip}:${active.port} · ${active.protocol.toUpperCase()}`
                : `${t('connected')}: ${statusLabel}`}
            </Text>
          </View>
          {active ? (
            <Pressable onPress={onDisconnect} style={styles.smallButton}>
              <Text style={[styles.smallButtonText, { color: '#F87171' }]}>{t('disconnect')}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hardwareRow}>
          <HardwareChip label="IR" ok={!irMissing} />
          <HardwareChip label="Mouse" ok={pointerSupported} />
          <HardwareChip label="Air" ok={airSupported} />
        </View>

        {irMissing ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={17} color="#F87171" />
            <Text style={[styles.warningText, { color: colors.text }]}>{t('irMissing')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={scanning}
          onPress={onScanNetwork}
          style={[styles.primaryButton, { backgroundColor: accent }]}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#081012" />
          ) : (
            <Ionicons name="wifi-outline" size={18} color="#081012" />
          )}
          <Text style={styles.primaryButtonText}>
            {scanning ? t('scanningNetwork') : t('scanNetwork')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={btScanning}
          onPress={onScanBluetooth}
          style={[
            styles.secondaryButton,
            { backgroundColor: colors.cardAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="bluetooth-outline" size={18} color={colors.text} />
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {t('scanBluetooth')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenManual}
        style={[
          styles.secondaryButton,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="add-circle-outline" size={18} color={accent} />
        <Text style={[styles.secondaryButtonText, { color: accent }]}>{t('manualAdd')}</Text>
      </Pressable>

      {scanProgressText ? (
        <Text style={[styles.scanStatus, { color: colors.secondary }]}>{scanProgressText}</Text>
      ) : null}

      {discoveredDevices.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('discoveredDevices')} ({discoveredDevices.length})
          </Text>
          {discoveredDevices.map((device) => (
            <Pressable
              key={device.id}
              accessibilityRole="button"
              onPress={() => onConnect(device)}
              style={[
                styles.deviceRow,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <View style={styles.deviceText}>
                <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.ip}:{device.port} · {device.source ?? device.protocol.toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {btDevices.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('scanBluetooth')} ({btDevices.length})
          </Text>
          {btDevices.map((device) => (
            <Pressable
              key={device.address}
              accessibilityRole="button"
              onPress={() =>
                onConnect({
                  id: `bt-${device.address}`,
                  name: device.name,
                  ip: '0.0.0.0',
                  port: 0,
                  protocol: 'adb',
                  transport: 'bluetooth',
                  bluetoothMac: device.address,
                })
              }
              style={[
                styles.deviceRow,
                { backgroundColor: colors.input, borderColor: colors.border },
              ]}
            >
              <View style={styles.deviceText}>
                <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.address}
                </Text>
              </View>
              <Text style={[styles.connectPill, { color: accent }]}>{t('bindHid')}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {t('savedDevices')} ({devices.length})
        </Text>
        {devices.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.secondary }]}>
            {t('noSavedDevices')}
          </Text>
        ) : (
          devices.map((device) => (
            <View
              key={device.id}
              style={[
                styles.deviceRow,
                {
                  backgroundColor:
                    device.id === activeDeviceId ? colors.accentSoft : colors.input,
                  borderColor:
                    device.id === activeDeviceId ? accent : colors.border,
                },
              ]}
            >
              <Pressable style={styles.deviceText} onPress={() => onConnect(device)}>
                <Text style={[styles.deviceName, { color: colors.text }]}>{device.name}</Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.transport === 'bluetooth'
                    ? `Bluetooth HID · ${device.bluetoothMac ?? t('connected')}`
                    : `${device.ip}:${device.port} · ${device.protocol.toUpperCase()}`}
                </Text>
              </Pressable>
              <Pressable onPress={() => onRemove(device.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#F87171" />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('tvBrands')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow}>
          {['Nikai', 'LG', 'Samsung', 'Sony', 'TCL', 'Hisense', 'Toshiba', 'AlHafidh', 'Star-X', 'Denka'].map(
            (brand) => (
              <Pressable
                key={brand}
                accessibilityRole="button"
                onPress={() => onTvBrandChange(brand)}
                style={[
                  styles.brandPill,
                  {
                    backgroundColor: tvBrand === brand ? accent : colors.cardAlt,
                    borderColor: tvBrand === brand ? accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.brandPillText,
                    { color: tvBrand === brand ? '#081012' : colors.text },
                  ]}
                >
                  {brand}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        <View style={styles.codeSetRow}>
          <Text style={[styles.cardHint, { color: colors.secondary }]}>{t('codeSet')}</Text>
          {[1, 2, 3].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => onTvCodeSetChange(value as 1 | 2 | 3)}
              style={[
                styles.codePill,
                {
                  backgroundColor: tvCodeSet === value ? accent : colors.cardAlt,
                  borderColor: tvCodeSet === value ? accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.codeText,
                  { color: tvCodeSet === value ? '#081012' : colors.text },
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('rooms')}</Text>
        {rooms.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.secondary }]}>{t('noRooms')}</Text>
        ) : (
          rooms.map((room) => (
            <View key={room.id} style={styles.deviceRow}>
              <Pressable
                style={styles.deviceText}
                onPress={() => onActivateRoom(room)}
              >
                <Text style={[styles.deviceName, { color: colors.text }]}>{room.name}</Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {`${room.tvBrand} · CS${room.tvCodeSet} · ${room.acBrand}`}
                </Text>
              </Pressable>
              <Pressable onPress={() => onDeleteRoom(room.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#F87171" />
              </Pressable>
            </View>
          ))
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onSaveRoom}
          style={[styles.primaryButton, { backgroundColor: accent }]}
        >
          <Ionicons name="save-outline" size={17} color="#081012" />
          <Text style={styles.primaryButtonText}>{t('saveRoom')}</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('appearance')}</Text>
        <Text style={[styles.cardHint, { color: colors.secondary }]}>{t('language')}</Text>
        <View style={styles.optionRow}>
          {(['ar', 'en'] as Language[]).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => onLanguageChange(value)}
              style={[
                styles.optionPill,
                {
                  backgroundColor: language === value ? accent : colors.cardAlt,
                  borderColor: language === value ? accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: language === value ? '#081012' : colors.text },
                ]}
              >
                {t(value === 'ar' ? 'arabic' : 'english')}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.cardHint, { color: colors.secondary }]}>{t('appearance')}</Text>
        <View style={styles.optionRow}>
          {(['system', 'dark', 'light'] as AppearanceMode[]).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => onAppearanceChange(value)}
              style={[
                styles.optionPill,
                {
                  backgroundColor: appearance === value ? accent : colors.cardAlt,
                  borderColor: appearance === value ? accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: appearance === value ? '#081012' : colors.text },
                ]}
              >
                {t(value)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.cardHint, { color: colors.secondary }]}>{t('theme')}</Text>
        <View style={styles.accentGrid}>
          {ACCENT_THEMES.map((theme) => (
            <Pressable
              key={theme.id}
              accessibilityRole="button"
              accessibilityLabel={theme.name[language]}
              onPress={() => onAccentChange(theme.id)}
              style={[
                styles.accentSwatch,
                {
                  backgroundColor: theme.value,
                  borderColor: accentId === theme.id ? colors.text : colors.border,
                },
              ]}
            >
              {accentId === theme.id ? (
                <Ionicons name="checkmark" size={14} color="#081012" />
              ) : null}
            </Pressable>
          ))}
        </View>
        <Text style={[styles.cardHint, { color: accent }]}>
          {ACCENT_THEMES.find((theme) => theme.id === accentId)?.name[language]}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('settings')}</Text>
        <ToggleRow
          label={t('haptics')}
          value={hapticsEnabled}
          colors={colors}
          onPress={onToggleHaptics}
        />
        <ToggleRow
          label={t('autoConnect')}
          value={autoConnect}
          colors={colors}
          onPress={onToggleAutoConnect}
        />
        <ToggleRow
          label="Keep Awake"
          value={keepAwake}
          colors={colors}
          onPress={onToggleKeepAwake}
        />
        <Text style={[styles.cardHint, { color: colors.secondary }]}>
          {t('sensitivity')}: {sensitivity.toFixed(2)}x
        </Text>
        <View style={styles.sensitivityRow}>
          {[0.8, 1.35, 1.9, 2.5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => onSensitivityChange(value)}
              style={[
                styles.sensitivityPill,
                {
                  backgroundColor:
                    Math.abs(sensitivity - value) < 0.08 ? accent : colors.cardAlt,
                },
              ]}
            >
              <Text
                style={[
                  styles.sensitivityText,
                  {
                    color:
                      Math.abs(sensitivity - value) < 0.08 ? '#081012' : colors.text,
                  },
                ]}
              >
                {value}x
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function HardwareChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View
      style={[
        styles.hardwareChip,
        {
          backgroundColor: ok
            ? 'rgba(52,211,153,0.16)'
            : 'rgba(248,113,113,0.16)',
        },
      ]}
    >
      <Ionicons
        name={ok ? 'checkmark-circle' : 'close-circle'}
        size={13}
        color={ok ? '#34D399' : '#F87171'}
      />
      <Text style={[styles.hardwareChipText, { color: ok ? '#34D399' : '#F87171' }]}>
        {label}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  colors,
  onPress,
}: {
  label: string;
  value: boolean;
  colors: RemoteExperienceColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={onPress}
      style={styles.toggleRow}
    >
      <Text style={[styles.toggleLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? colors.accent : colors.cardAlt },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { transform: [{ translateX: value ? 18 : 0 }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 30, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardHint: { fontSize: 11 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1 },
  smallButton: { paddingHorizontal: 10, paddingVertical: 6 },
  smallButtonText: { fontSize: 11, fontWeight: '800' },
  hardwareRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  hardwareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hardwareChipText: { fontSize: 10, fontWeight: '800' },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  warningText: { flex: 1, fontSize: 11, lineHeight: 16 },
  actionRow: { flexDirection: 'row', gap: 8 },
  primaryButton: {
    flex: 2,
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  primaryButtonText: { color: '#081012', fontSize: 11, fontWeight: '900' },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryButtonText: { fontSize: 11, fontWeight: '800' },
  scanStatus: { fontSize: 11, lineHeight: 16 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceText: { flex: 1 },
  deviceName: { fontSize: 12, fontWeight: '800' },
  deviceMeta: { fontSize: 10, marginTop: 2 },
  connectPill: { fontSize: 10, fontWeight: '900' },
  emptyHint: { fontSize: 11, lineHeight: 16 },
  brandRow: { marginBottom: 4 },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  brandPillText: { fontSize: 11, fontWeight: '800' },
  codeSetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  codeText: { fontSize: 11, fontWeight: '900' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  optionText: { fontSize: 11, fontWeight: '800' },
  accentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accentSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { fontSize: 12, fontWeight: '700' },
  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  sensitivityRow: { flexDirection: 'row', gap: 8 },
  sensitivityPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensitivityText: { fontSize: 10, fontWeight: '900' },
});
