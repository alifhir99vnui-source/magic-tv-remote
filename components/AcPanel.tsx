import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RemoteExperienceColors } from './RemoteExperience';
import { TranslationKey } from '../utils/i18n';
import {
  AC_BRANDS,
  AC_CODE_SETS,
  AC_FANS,
  AC_MODES,
  AC_SLEEP_TIMERS,
  AcBrand,
  AcCodeSet,
  AcFan,
  AcMode,
  AcState,
  createDefaultAcState,
  getAcBrandProfile,
} from '../utils/acIr';

interface AcPanelProps {
  colors: RemoteExperienceColors;
  t: (key: TranslationKey) => string;
  language: 'ar' | 'en';
  onPressFeedback?: () => void;
  onSendIr: (brand: AcBrand, state: AcState, codeSet: AcCodeSet) => Promise<void>;
  onStateChange?: (brand: AcBrand, codeSet: AcCodeSet, state: AcState) => void;
  initialBrand?: AcBrand;
  initialCodeSet?: AcCodeSet;
  initialState?: AcState;
  disabled?: boolean;
  irMissing?: boolean;
}

const MODE_KEYS: Record<AcMode, TranslationKey> = {
  Auto: 'auto',
  Cool: 'cool',
  Heat: 'heat',
  Dry: 'dry',
  Fan: 'fanMode',
};

const FAN_KEYS: Record<AcFan, TranslationKey> = {
  Auto: 'auto',
  Low: 'low',
  Medium: 'medium',
  High: 'high',
};

function AcPanelComponent({
  colors,
  t,
  language,
  onPressFeedback,
  onSendIr,
  onStateChange,
  initialBrand,
  initialCodeSet,
  initialState,
  disabled,
  irMissing,
}: AcPanelProps) {
  const [brand, setBrand] = useState<AcBrand>(initialBrand ?? 'Tosot');
  const [codeSet, setCodeSet] = useState<AcCodeSet>(initialCodeSet ?? 1);
  const [state, setState] = useState<AcState>(initialState ?? createDefaultAcState());
  const accent = colors.accent;
  const profile = getAcBrandProfile(brand);

  useEffect(() => {
    if (initialBrand) setBrand(initialBrand);
    if (initialCodeSet) setCodeSet(initialCodeSet);
    if (initialState) setState(initialState);
  }, [initialBrand, initialCodeSet, initialState]);

  useEffect(() => {
    onStateChange?.(brand, codeSet, state);
  }, [brand, codeSet, state, onStateChange]);

  const update = (patch: Partial<AcState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const submit = async () => {
    await onSendIr(brand, state, codeSet);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('acControl')}</Text>
      <Text style={[styles.subtitle, { color: colors.secondary }]}>{t('selectUnit')}</Text>

      <Text style={[styles.sectionTitle, { color: colors.secondary }]}>{t('acBrands')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.brandRow}
      >
        {AC_BRANDS.map((item) => {
          const selected = brand === item.brand;
          return (
            <Pressable
      onPressIn={onPressFeedback}
              key={item.brand}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setBrand(item.brand);
                setState((current) => ({
                  ...current,
                  temperature: Math.min(
                    item.maxTemperature,
                    Math.max(item.minTemperature, current.temperature),
                  ),
                }));
              }}
              style={[
                styles.brandPill,
                {
                  backgroundColor: selected ? accent : colors.card,
                  borderColor: selected ? accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.brandPillText,
                  { color: selected ? '#081012' : colors.text },
                ]}
              >
                {item.label[language]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.codeSetRow}>
        <Text style={[styles.cardHint, { color: colors.secondary }]}>{t('codeSet')}</Text>
        {AC_CODE_SETS.map((value) => (
          <Pressable
      onPressIn={onPressFeedback}
            key={value}
            accessibilityRole="button"
            onPress={() => setCodeSet(value)}
            style={[
              styles.codePill,
              {
                backgroundColor: codeSet === value ? accent : colors.cardAlt,
                borderColor: codeSet === value ? accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.codeText,
                { color: codeSet === value ? '#081012' : colors.text },
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.protocolHint, { color: colors.secondary }]}>
        {`${profile.protocol} · ${profile.detail[language]}`}
      </Text>

      {irMissing ? (
        <View
          style={[
            styles.irWarning,
            { backgroundColor: colors.cardAlt, borderColor: '#F87171' },
          ]}
        >
          <Ionicons name="warning-outline" size={17} color="#F87171" />
          <Text style={[styles.irWarningText, { color: colors.text }]}>{t('irMissing')}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.powerRow}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t('power')}</Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              {state.power ? t('on') : t('off')}
            </Text>
          </View>
          <Pressable
      onPressIn={onPressFeedback}
            accessibilityRole="switch"
            accessibilityState={{ checked: state.power }}
            onPress={() => update({ power: !state.power })}
            style={[
              styles.powerButton,
              { backgroundColor: state.power ? accent : colors.cardAlt },
            ]}
          >
            <Ionicons
              name="power"
              size={26}
              color={state.power ? '#081012' : colors.secondary}
            />
          </Pressable>
        </View>

        <View style={styles.temperatureRow}>
          <Pressable
            onPressIn={onPressFeedback}
            accessibilityRole="button"
            accessibilityLabel={t('temperature')}
            onPress={() =>
              update({ temperature: Math.min(profile.maxTemperature, state.temperature + 1) })
            }
            style={[styles.tempButton, { borderColor: colors.border }]}
          >
            <Ionicons name="add-outline" size={24} color={colors.text} />
          </Pressable>
          <View>
            <Text style={[styles.temperature, { color: colors.text }]}>
              {state.temperature}°
            </Text>
            <Text style={[styles.cardHint, { color: colors.secondary }]}>
              {t('temperature')}
            </Text>
          </View>
          <Pressable
            onPressIn={onPressFeedback}
            accessibilityRole="button"
            accessibilityLabel={t('temperature')}
            onPress={() =>
              update({ temperature: Math.max(profile.minTemperature, state.temperature - 1) })
            }
            style={[styles.tempButton, { borderColor: colors.border }]}
          >
            <Ionicons name="remove-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('mode')}</Text>
        <View style={styles.optionRow}>
          {AC_MODES.map((mode) => {
            const selected = state.mode === mode;
            return (
              <Pressable
      onPressIn={onPressFeedback}
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update({ mode })}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? accent : colors.cardAlt,
                    borderColor: selected ? accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? '#081012' : colors.text },
                  ]}
                >
                  {t(MODE_KEYS[mode])}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('fan')}</Text>
        <View style={styles.optionRow}>
          {AC_FANS.map((fan) => {
            const selected = state.fan === fan;
            return (
              <Pressable
      onPressIn={onPressFeedback}
                key={fan}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update({ fan })}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selected ? accent : colors.cardAlt,
                    borderColor: selected ? accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? '#081012' : colors.text },
                  ]}
                >
                  {t(FAN_KEYS[fan])}
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
          label={t('swing')}
          value={state.swing}
          colors={colors}
          onPressFeedback={onPressFeedback}
          onPress={() => update({ swing: !state.swing })}
        />
        <ToggleRow
          label={t('quickCool')}
          value={state.turbo}
          colors={colors}
          onPressFeedback={onPressFeedback}
          onPress={() => update({ turbo: !state.turbo })}
        />
        <ToggleRow
          label={t('eco')}
          value={state.eco}
          colors={colors}
          onPressFeedback={onPressFeedback}
          onPress={() => update({ eco: !state.eco })}
        />
        <ToggleRow
          label={t('ledOff')}
          value={state.ledOff}
          colors={colors}
          onPressFeedback={onPressFeedback}
          onPress={() => update({ ledOff: !state.ledOff })}
        />
        <ToggleRow
          label={t('sleepTimer')}
          value={state.sleepTimer > 0 || state.sleep}
          colors={colors}
          onPressFeedback={onPressFeedback}
          onPress={() => {
            const index = AC_SLEEP_TIMERS.indexOf(state.sleepTimer);
            const next = AC_SLEEP_TIMERS[(index + 1) % AC_SLEEP_TIMERS.length];
            update({ sleepTimer: next, sleep: next > 0 });
          }}
        />
        {state.sleepTimer > 0 ? (
          <Text style={[styles.cardHint, { color: accent }]}>{`${state.sleepTimer} min`}</Text>
        ) : null}
      </View>

      <Pressable
      onPressIn={onPressFeedback}
        accessibilityRole="button"
        disabled={disabled}
        onPress={submit}
        style={[
          styles.sendButton,
          { backgroundColor: disabled ? colors.cardAlt : accent },
        ]}
      >
        <Ionicons
          name="radio-outline"
          size={20}
          color={disabled ? colors.secondary : '#081012'}
        />
        <Text
          style={[
            styles.sendText,
            { color: disabled ? colors.secondary : '#081012' },
          ]}
        >
          {t('sendIr')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

export const AcPanel = React.memo(AcPanelComponent);

function ToggleRow({
  label,
  value,
  colors,
  onPressFeedback,
  onPress,
}: {
  label: string;
  value: boolean;
  colors: RemoteExperienceColors;
  onPressFeedback?: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPressIn={onPressFeedback}
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
  content: { padding: 18, paddingBottom: 36 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontWeight: '900', marginBottom: 6 },
  brandRow: { marginBottom: 8 },
  codeSetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  codePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  codeText: { fontSize: 11, fontWeight: '900' },
  protocolHint: { fontSize: 11, lineHeight: 16, marginBottom: 12 },
  irWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  irWarningText: { flex: 1, fontSize: 11, lineHeight: 16 },
  brandPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  brandPillText: { fontSize: 12, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  cardHint: { fontSize: 11 },
  powerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  optionPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  optionText: { fontSize: 12, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600' },
  toggleTrack: { width: 42, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 3 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
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
