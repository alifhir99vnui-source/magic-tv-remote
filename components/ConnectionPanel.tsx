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

const ACCENT = '#7CE3C3';

interface ConnectionPanelProps {
  colors: RemoteExperienceColors;
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
  sensitivity: number;
  onConnect: (device: SavedDevice) => void;
  onDisconnect: () => void;
  onRemove: (id: string) => void;
  onScanNetwork: () => void;
  onScanBluetooth: () => void;
  onOpenManual: () => void;
  onToggleHaptics: () => void;
  onToggleAutoConnect: () => void;
  onSensitivityChange: (value: number) => void;
}

export function ConnectionPanel({
  colors,
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
  sensitivity,
  onConnect,
  onDisconnect,
  onRemove,
  onScanNetwork,
  onScanBluetooth,
  onOpenManual,
  onToggleHaptics,
  onToggleAutoConnect,
  onSensitivityChange,
}: ConnectionPanelProps) {
  const active = devices.find((device) => device.id === activeDeviceId) ?? null;
  const statusLabel =
    connectionStatus === 'connected'
      ? 'متصل'
      : connectionStatus === 'connecting'
        ? 'جاري الاتصال'
        : 'غير متصل';
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
      <Text style={[styles.title, { color: colors.text }]}>الاتصال والإعدادات</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        اكتشف صندوق Magic A200 Pro تلقائياً أو أضفه يدوياً، وتابع حالة الريموت والمُرسِل IR.
      </Text>

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
              {active ? active.name : 'لا يوجد جهاز محدد'}
            </Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              {active
                ? active.transport === 'bluetooth'
                  ? `Bluetooth HID · ${active.bluetoothMac ?? 'مقترن'}`
                  : `${active.ip}:${active.port} · ${active.protocol.toUpperCase()}`
                : `الحالة: ${statusLabel}`}
            </Text>
          </View>
          {active ? (
            <Pressable onPress={onDisconnect} style={styles.smallButton}>
              <Text style={[styles.smallButtonText, { color: '#F87171' }]}>افصل</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.hardwareRow}>
          <HardwareChip label=" IR" ok={!irMissing} />
          <HardwareChip label=" Mouse" ok={pointerSupported} />
          <HardwareChip label=" Air" ok={airSupported} />
        </View>

        {irMissing ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={17} color="#F87171" />
            <Text style={[styles.warningText, { color: colors.text }]}>
              جهازك لا يدعم إرسال IR مباشرة. أوامر التكييف تعمل فقط مع صندوق Magic A200 Pro أو هاتف بمُرسِل IR.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={scanning}
          onPress={onScanNetwork}
          style={[styles.primaryButton, { backgroundColor: ACCENT }]}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#081012" />
          ) : (
            <Ionicons name="wifi-outline" size={18} color="#081012" />
          )}
          <Text style={styles.primaryButtonText}>
            {scanning ? 'جاري الفحص...' : 'فحص mDNS / SSDP / الشبكة'}
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
            أجهزة Bluetooth
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
        <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
        <Text style={[styles.secondaryButtonText, { color: ACCENT }]}>
          إضافة يدوية (IP / Port أو Bluetooth HID)
        </Text>
      </Pressable>

      {scanProgressText ? (
        <Text style={[styles.scanStatus, { color: colors.secondary }]}>
          {scanProgressText}
        </Text>
      ) : null}

      {discoveredDevices.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            أجهزة تم اكتشافها ({discoveredDevices.length})
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
                <Text style={[styles.deviceName, { color: colors.text }]}>
                  {device.name}
                </Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.ip}:{device.port} · {device.source ?? device.protocol.toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ACCENT} />
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
            Bluetooth HID ({btDevices.length})
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
                <Text style={[styles.deviceName, { color: colors.text }]}>
                  {device.name}
                </Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.address}
                </Text>
              </View>
              <Text style={styles.connectPill}>ربط HID</Text>
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
          الأجهزة المحفوظة ({devices.length})
        </Text>
        {devices.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.secondary }]}>
            لا توجد أجهزة محفوظة. استخدم الفحص أو الإضافة اليدوية.
          </Text>
        ) : (
          devices.map((device) => (
            <View
              key={device.id}
              style={[
                styles.deviceRow,
                {
                  backgroundColor:
                    device.id === activeDeviceId ? colors.cardAlt : colors.input,
                  borderColor:
                    device.id === activeDeviceId ? ACCENT : colors.border,
                },
              ]}
            >
              <Pressable
                style={styles.deviceText}
                onPress={() => onConnect(device)}
              >
                <Text style={[styles.deviceName, { color: colors.text }]}>
                  {device.name}
                </Text>
                <Text style={[styles.deviceMeta, { color: colors.secondary }]}>
                  {device.transport === 'bluetooth'
                    ? `Bluetooth HID · ${device.bluetoothMac ?? 'مقترن'}`
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
        <Text style={[styles.cardTitle, { color: colors.text }]}>إعدادات الريموت</Text>
        <ToggleRow
          label="الاهتزاز اللمسي"
          value={hapticsEnabled}
          colors={colors}
          onPress={onToggleHaptics}
        />
        <ToggleRow
          label="الاتصال التلقائي بآخر جهاز"
          value={autoConnect}
          colors={colors}
          onPress={onToggleAutoConnect}
        />
        <Text style={[styles.cardHint, { color: colors.secondary }]}>
          حساسية المؤشر: {sensitivity.toFixed(2)}x
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
                    Math.abs(sensitivity - value) < 0.08 ? ACCENT : colors.cardAlt,
                },
              ]}
            >
              <Text
                style={[
                  styles.sensitivityText,
                  {
                    color:
                      Math.abs(sensitivity - value) < 0.08
                        ? '#081012'
                        : colors.text,
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
        { backgroundColor: ok ? 'rgba(52,211,153,0.16)' : 'rgba(248,113,113,0.16)' },
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
          { backgroundColor: value ? ACCENT : colors.cardAlt },
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
  connectPill: { color: ACCENT, fontSize: 10, fontWeight: '900' },
  emptyHint: { fontSize: 11, lineHeight: 16 },
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
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
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
