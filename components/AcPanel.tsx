import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RemoteExperienceColors,
} from './RemoteExperience';
import {
  AcBrand,
  AcFan,
  AcMode,
  AcState,
} from '../utils/acIr';

const ACCENT = '#7CE3C3';
const BRANDS: AcBrand[] = ['Tosot', 'Gree', 'LG', 'Samsung', 'Midea'];
const MODES: AcMode[] = ['Auto', 'Cool', 'Heat', 'Dry', 'Fan'];
const FANS: AcFan[] = ['Auto', 'Low', 'Medium', 'High'];

interface AcPanelProps {
  colors: RemoteExperienceColors;
  onSendIr: (brand: AcBrand, state: AcState) => Promise<void>;
  disabled?: boolean;
}

export function AcPanel({ colors, onSendIr, disabled }: AcPanelProps) {
  const [brand, setBrand] = useState<AcBrand>('Tosot');
  const [state, setState] = useState<AcState>({
    power: false,
    temperature: 24,
    mode: 'Cool',
    fan: 'Auto',
    swing: false,
    turbo: false,
    sleep: false,
  });

  const update = (patch: Partial<AcState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const submit = async () => {
    await onSendIr(brand, state);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>تحكم السplit</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>
        اختر نوع الوحدة، اضبط الإعدادات، ثم أرسل أمر IR.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.brandRow}
      >
        {BRANDS.map((item) => {
          const selected = brand === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setBrand(item)}
              style={[
                styles.brandPill,
                {
                  backgroundColor: selected ? ACCENT : colors.card,
                  borderColor: selected ? ACCENT : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.brandPillText,
                  { color: selected ? '#0A1012' : colors.text },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.powerRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>التشغيل</Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              {state.power ? 'الوحدة تعمل' : 'الوحدة متوقفة'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: state.power }}
            onPress={() => update({ power: !state.power })}
            style={[
              styles.powerButton,
              { backgroundColor: state.power ? ACCENT : colors.cardAlt },
            ]}
          >
            <Ionicons
              name="power"
              size={26}
              color={state.power ? '#0A1012' : colors.secondary}
            />
          </Pressable>
        </View>

        <View style={styles.temperatureRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إنقاص الحرارة"
            onPress={() =>
              update({ temperature: Math.max(16, state.temperature - 1) })
            }
            style={[styles.tempButton, { borderColor: colors.border }]}
          >
            <Ionicons name="remove-outline" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.temperature, { color: colors.text }]}>
              {state.temperature}°
            </Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              درجة الحرارة
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="زيادة الحرارة"
            onPress={() =>
              update({ temperature: Math.min(30, state.temperature + 1) })
            }
            style={[styles.tempButton, { borderColor: colors.border }]}
          >
            <Ionicons name="add-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>الوضع</Text>
        <View style={styles.optionRow}>
          {MODES.map((mode) => {
            const selected = state.mode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update({ mode })}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? ACCENT : colors.cardAlt,
                    borderColor: selected ? ACCENT : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? '#0A1012' : colors.text },
                  ]}
                >
                  {mode}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.cardTitle, { color: colors.text }]}>المروحة</Text>
        <View style={styles.optionRow}>
          {FANS.map((fan) => {
            const selected = state.fan === fan;
            return (
              <Pressable
                key={fan}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update({ fan })}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? ACCENT : colors.cardAlt,
                    borderColor: selected ? ACCENT : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? '#0A1012' : colors.text },
                  ]}
                >
                  {fan}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ToggleRow
          label="تذبذب / Swing"
          value={state.swing}
          colors={colors}
          onPress={() => update({ swing: !state.swing })}
        />
        <ToggleRow
          label="تيربو"
          value={state.turbo}
          colors={colors}
          onPress={() => update({ turbo: !state.turbo })}
        />
        <ToggleRow
          label="سليب"
          value={state.sleep}
          colors={colors}
          onPress={() => update({ sleep: !state.sleep })}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={submit}
        style={[
          styles.sendButton,
          { backgroundColor: disabled ? colors.cardAlt : ACCENT },
        ]}
      >
        <Ionicons
          name="radio-outline"
          size={20}
          color={disabled ? colors.secondary : '#0A1012'}
        />
        <Text
          style={[
            styles.sendText,
            { color: disabled ? colors.secondary : '#0A1012' },
          ]}
        >
          إرسال إلى السplit
        </Text>
      </Pressable>
    </ScrollView>
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
  content: { padding: 18, paddingBottom: 36 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 14 },
  brandRow: { marginBottom: 14 },
  brandPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  brandPillText: { fontSize: 12, fontWeight: '700' },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  cardHint: { fontSize: 11 },
  powerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  powerButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperatureRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tempButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperature: { fontSize: 34, fontWeight: '800', textAlign: 'center' },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: { fontSize: 12, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600' },
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
  sendButton: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: { fontSize: 15, fontWeight: '800' },
});
