import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TranslationKey } from '../utils/i18n';

export interface RemoteAppShortcut {
  id: string;
  name: string;
  packageName: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface RemoteExperienceColors {
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  secondary: string;
  input: string;
  accent: string;
  accentSoft: string;
}

export interface RemoteMouseController {
  mode: 'touchpad' | 'air';
  setMode: (mode: 'touchpad' | 'air') => void;
  pointerSupported: boolean;
  airSupported: boolean;
  pointerStatus: string;
  airStatus: string;
  sensitivity: number;
  setSensitivity: (value: number) => void;
  onTouchpadDelta: (dx: number, dy: number) => void;
  onTouchpadPress: () => void;
  onRightClick: () => void;
  onRecenter: () => void;
  onScroll: (deltaY: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

interface RemoteExperienceProps {
  activeTab: 'remote' | 'mouse';
  onTabChange: (tab: 'remote' | 'mouse') => void;
  onSendKey: (key: string) => void;
  onOpenSettings?: () => void;
  onOpenKeyboard?: () => void;
  onOpenApps?: () => void;
  onQuickPaste?: () => void;
  onVoiceSearch?: () => void;
  t: (key: TranslationKey) => string;
  colors: RemoteExperienceColors;
  isConnected: boolean;
  apps: RemoteAppShortcut[];
  onLaunchApp: (packageName: string) => void;
  mouse: RemoteMouseController;
}

export function RemoteExperience({
  activeTab,
  onTabChange,
  onSendKey,
  onOpenSettings,
  onOpenKeyboard,
  onOpenApps,
  onQuickPaste,
  onVoiceSearch,
  t,
  colors,
  apps,
  onLaunchApp,
  mouse,
}: RemoteExperienceProps) {
  const [keypadVisible, setKeypadVisible] = useState(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const draggingRef = useRef(false);
  const accent = colors.accent;

  const touchpadResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          lastTouchRef.current = {
            x: evt.nativeEvent.pageX,
            y: evt.nativeEvent.pageY,
          };
          movedRef.current = false;
          draggingRef.current = false;
        },
        onPanResponderMove: (evt) => {
          if (!lastTouchRef.current) return;
          const dx = evt.nativeEvent.pageX - lastTouchRef.current.x;
          const dy = evt.nativeEvent.pageY - lastTouchRef.current.y;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            if (!movedRef.current) {
              movedRef.current = true;
              draggingRef.current = true;
              mouse.onDragStart();
            }
            mouse.onTouchpadDelta(dx, dy);
            lastTouchRef.current = {
              x: evt.nativeEvent.pageX,
              y: evt.nativeEvent.pageY,
            };
          }
        },
        onPanResponderRelease: () => {
          if (draggingRef.current) mouse.onDragEnd();
          else if (!movedRef.current) mouse.onTouchpadPress();
          lastTouchRef.current = null;
          movedRef.current = false;
          draggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          if (draggingRef.current) mouse.onDragEnd();
          lastTouchRef.current = null;
          movedRef.current = false;
          draggingRef.current = false;
        },
      }),
    [mouse],
  );

  const roundButton = (
    key: string,
    label: TranslationKey,
    icon: keyof typeof Ionicons.glyphMap,
    action: () => void,
    active = false,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={action}
      style={[
        styles.circleActionButton,
        {
          backgroundColor: active ? colors.accentSoft : colors.card,
          borderColor: active ? accent : colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={19} color={active ? accent : colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.modeSwitcher,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === 'remote' }}
          onPress={() => onTabChange('remote')}
          style={[
            styles.modeButton,
            activeTab === 'remote' && {
              backgroundColor: colors.accentSoft,
              borderColor: accent,
            },
          ]}
        >
          <Ionicons
            name="keypad-outline"
            size={16}
            color={activeTab === 'remote' ? accent : colors.secondary}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: activeTab === 'remote' ? accent : colors.secondary },
            ]}
          >
            {t('buttons')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === 'mouse' }}
          onPress={() => onTabChange('mouse')}
          style={[
            styles.modeButton,
            activeTab === 'mouse' && {
              backgroundColor: colors.accentSoft,
              borderColor: accent,
            },
          ]}
        >
          <Ionicons
            name="hand-left-outline"
            size={16}
            color={activeTab === 'mouse' ? accent : colors.secondary}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: activeTab === 'mouse' ? accent : colors.secondary },
            ]}
          >
            {t('mouse')}
          </Text>
        </Pressable>
      </View>

      {activeTab === 'remote' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topActionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('power')}
              onPress={() => onSendKey('power')}
              style={[styles.powerButton, { borderColor: '#7F1D1D' }]}
            >
              <Ionicons name="power" size={21} color="#F87171" />
            </Pressable>
            {roundButton('source', 'source', 'tv-outline', () => onSendKey('source'))}
            {roundButton('mute', 'mute', 'volume-mute-outline', () => onSendKey('mute'))}
            {roundButton('keyboard', 'keyboard', 'keypad-outline', () => onOpenKeyboard?.())}
            {roundButton('paste', 'quickPaste', 'clipboard-outline', () => onQuickPaste?.())}
            {roundButton('apps', 'apps', 'apps-outline', () => onOpenApps?.())}
            {roundButton('info', 'info', 'information-circle-outline', () => onSendKey('info'))}
            {roundButton('numpad', 'numpad', 'grid-outline', () => setKeypadVisible((v) => !v), keypadVisible)}
            {roundButton('settings', 'settings', 'settings-outline', () => onOpenSettings?.())}
          </View>

          {keypadVisible && (
            <View
              style={[
                styles.numpadCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['menu', '0', 'back'],
              ].map((row, rIndex) => (
                <View key={rIndex} style={styles.numpadRow}>
                  {row.map((item) => (
                    <Pressable
                      key={item}
                      accessibilityRole="button"
                      onPress={() => onSendKey(/^[0-9]$/.test(item) ? `num${item}` : item)}
                      style={[
                        styles.numpadKey,
                        { backgroundColor: colors.input, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.numpadKeyText, { color: colors.text }]}>
                        {item === 'menu' ? 'MENU' : item === 'back' ? 'DEL' : item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View
            style={[
              styles.dpadOuter,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('up')}
              onPress={() => onSendKey('up')}
              style={styles.dpadTop}
            >
              <Ionicons name="chevron-up" size={26} color={colors.text} />
            </Pressable>
            <View style={styles.dpadMiddleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('left')}
                onPress={() => onSendKey('left')}
                style={styles.dpadSide}
              >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('ok')}
                onPress={() => onSendKey('ok')}
                style={[styles.okButton, { backgroundColor: accent }]}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('right')}
                onPress={() => onSendKey('right')}
                style={styles.dpadSide}
              >
                <Ionicons name="chevron-forward" size={26} color={colors.text} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('down')}
              onPress={() => onSendKey('down')}
              style={styles.dpadBottom}
            >
              <Ionicons name="chevron-down" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.navRow}>
            {[
              ['back', 'back', 'arrow-back-outline'],
              ['home', 'home', 'home-outline'],
              ['menu', 'menu', 'menu-outline'],
              ['recents', 'recentApps', 'albums-outline'],
            ].map(([key, label, icon]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(label as TranslationKey)}
                onPress={() => onSendKey(key)}
                style={[
                  styles.navPill,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={17}
                  color={colors.text}
                />
                <Text style={[styles.navPillText, { color: colors.text }]}>
                  {t(label as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.rockersRow}>
            <View
              style={[
                styles.rockerCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('volumeUp')}
                onPress={() => onSendKey('volumeUp')}
                style={styles.rockerHalf}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.rockerLabel, { color: colors.secondary }]}>
                {t('volume')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('volumeDown')}
                onPress={() => onSendKey('volumeDown')}
                style={styles.rockerHalf}
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('voiceSearch')}
              onPress={onVoiceSearch ?? (() => onSendKey('voice'))}
              style={[
                styles.voiceButton,
                { backgroundColor: colors.accentSoft, borderColor: accent },
              ]}
            >
              <Ionicons name="mic-outline" size={24} color={accent} />
              <Text style={[styles.voiceLabel, { color: accent }]}>{t('voiceSearch')}</Text>
            </Pressable>

            <View
              style={[
                styles.rockerCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('channelUp')}
                onPress={() => onSendKey('channelUp')}
                style={styles.rockerHalf}
              >
                <Ionicons name="chevron-up" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.rockerLabel, { color: colors.secondary }]}>
                {t('channel')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('channelDown')}
                onPress={() => onSendKey('channelDown')}
                style={styles.rockerHalf}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.mediaRow}>
            {[
              ['rewind', 'rewind', 'play-skip-back-outline'],
              ['playPause', 'playPause', 'pause-circle-outline'],
              ['forward', 'forward', 'play-skip-forward-outline'],
              ['stop', 'stop', 'stop-circle-outline'],
              ['source', 'source', 'tv-outline'],
            ].map(([key, label, icon]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(label as TranslationKey)}
                onPress={() => onSendKey(key)}
                style={[
                  styles.mediaButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={accent}
                />
                <Text style={[styles.mediaButtonText, { color: colors.text }]}>
                  {t(label as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            style={[
              styles.smartCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
              {t('smartButtons')}
            </Text>
            <View style={styles.smartRow}>
              {[
                ['red', 'red', '#F87171'],
                ['green', 'green', '#34D399'],
                ['yellow', 'yellow', '#FBBF24'],
                ['blue', 'blue', '#60A5FA'],
              ].map(([key, label, color]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={t(label as TranslationKey)}
                  onPress={() => onSendKey(key)}
                  style={[styles.colorButton, { backgroundColor: color }]}
                >
                  <Text style={styles.colorButtonText}>{t(label as TranslationKey)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.smartRow}>
              {[
                ['subtitle', 'subtitle', 'language-outline'],
                ['audio', 'audio', 'musical-notes-outline'],
                ['info', 'info', 'information-circle-outline'],
                ['menu', 'menu', 'options-outline'],
              ].map(([key, label, icon]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={t(label as TranslationKey)}
                  onPress={() => onSendKey(key)}
                  style={[
                    styles.smartPill,
                    { backgroundColor: colors.cardAlt, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={15}
                    color={accent}
                  />
                  <Text style={[styles.smartPillText, { color: colors.text }]}>
                    {t(label as TranslationKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.appsSection}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
              {t('favoriteApps')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.appsRow}
            >
              {apps.map((app) => (
                <Pressable
                  key={app.id}
                  accessibilityRole="button"
                  onPress={() => onLaunchApp(app.packageName)}
                  style={[
                    styles.appChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name={app.icon} size={18} color={accent} />
                  <Text style={[styles.appChipText, { color: colors.text }]}>
                    {app.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mouseContainer}>
          <View style={styles.mouseModeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mouse.mode === 'touchpad' }}
              onPress={() => mouse.setMode('touchpad')}
              style={[
                styles.mouseModePill,
                {
                  backgroundColor:
                    mouse.mode === 'touchpad' ? colors.accentSoft : colors.card,
                  borderColor: mouse.mode === 'touchpad' ? accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.mouseModeText,
                  { color: mouse.mode === 'touchpad' ? accent : colors.text },
                ]}
              >
                {t('touchpad')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mouse.mode === 'air' }}
              disabled={!mouse.airSupported}
              onPress={() => mouse.setMode(mouse.mode === 'air' ? 'touchpad' : 'air')}
              style={[
                styles.mouseModePill,
                {
                  backgroundColor: mouse.mode === 'air' ? colors.accentSoft : colors.card,
                  borderColor: mouse.mode === 'air' ? accent : colors.border,
                  opacity: mouse.airSupported ? 1 : 0.5,
                },
              ]}
            >
              <Text
                style={[
                  styles.mouseModeText,
                  { color: mouse.mode === 'air' ? accent : colors.text },
                ]}
              >
                {mouse.airSupported ? t('airMouse') : t('airUnavailable')}
              </Text>
            </Pressable>
          </View>

          <View
            {...touchpadResponder.panHandlers}
            style={[
              styles.touchpadArea,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={mouse.mode === 'air' ? 'navigate-circle-outline' : 'finger-print-outline'}
              size={34}
              color={accent}
            />
            <Text style={[styles.touchpadStatus, { color: colors.text }]}>
              {mouse.mode === 'air' ? mouse.airStatus : mouse.pointerStatus}
            </Text>
            <Text style={[styles.touchpadHint, { color: colors.secondary }]}>
              {t('touchpadHint')}
            </Text>
          </View>

          <View style={styles.mouseButtonsRow}>
            {[
              ['leftClick', 'left', mouse.onTouchpadPress],
              ['rightClick', 'right', mouse.onRightClick],
              ['recenter', 'center', mouse.onRecenter],
            ].map(([label, icon, action]) => (
              <Pressable
                key={String(label)}
                accessibilityRole="button"
                onPress={action as () => void}
                style={[
                  styles.mouseActionButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={
                    (icon === 'left'
                      ? 'checkbox-outline'
                      : icon === 'right'
                        ? 'square-outline'
                        : 'locate-outline') as keyof typeof Ionicons.glyphMap
                  }
                  size={15}
                  color={accent}
                />
                <Text style={[styles.mouseActionText, { color: colors.text }]}>
                  {t(label as TranslationKey)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.scrollControlsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => mouse.onScroll(-30)}
              style={[
                styles.scrollButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="arrow-up" size={17} color={colors.text} />
              <Text style={[styles.scrollButtonText, { color: colors.text }]}>
                {t('scrollUp')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => mouse.onScroll(30)}
              style={[
                styles.scrollButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="arrow-down" size={17} color={colors.text} />
              <Text style={[styles.scrollButtonText, { color: colors.text }]}>
                {t('scrollDown')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 8,
    padding: 4,
    borderWidth: 1,
    borderRadius: 16,
  },
  modeButton: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  modeButtonText: { fontSize: 12, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 16, gap: 12 },
  topActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  powerButton: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1215',
    borderWidth: 1,
    borderRadius: 23,
  },
  circleActionButton: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 23,
  },
  numpadCard: { padding: 10, gap: 8, borderWidth: 1, borderRadius: 18 },
  numpadRow: { flexDirection: 'row', gap: 8 },
  numpadKey: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  numpadKeyText: { fontSize: 13, fontWeight: '800' },
  dpadOuter: {
    alignSelf: 'center',
    width: 214,
    height: 214,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 107,
  },
  dpadTop: { width: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  dpadMiddleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dpadSide: { width: 44, height: 64, alignItems: 'center', justifyContent: 'center' },
  okButton: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', borderRadius: 37 },
  okButtonText: { color: '#0A1012', fontSize: 16, fontWeight: '900' },
  dpadBottom: { width: 64, height: 44, alignItems: 'center', justifyContent: 'center' },
  navRow: { flexDirection: 'row', gap: 6 },
  navPill: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  navPillText: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  rockersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rockerCard: {
    flex: 1,
    height: 108,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 22,
  },
  rockerHalf: { width: '100%', height: 36, alignItems: 'center', justifyContent: 'center' },
  rockerLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  voiceButton: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 39,
  },
  voiceLabel: { fontSize: 9, fontWeight: '800', textAlign: 'center' },
  mediaRow: { flexDirection: 'row', gap: 6 },
  mediaButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  mediaButtonText: { fontSize: 8, fontWeight: '700', textAlign: 'center' },
  smartCard: { padding: 12, gap: 10, borderWidth: 1, borderRadius: 18 },
  sectionTitle: { fontSize: 10, fontWeight: '900' },
  smartRow: { flexDirection: 'row', gap: 6 },
  colorButton: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  colorButtonText: { color: '#081012', fontSize: 9, fontWeight: '900' },
  smartPill: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
  },
  smartPillText: { fontSize: 8, fontWeight: '700', textAlign: 'center' },
  appsSection: { gap: 6 },
  appsRow: { gap: 8 },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 14,
  },
  appChipText: { fontSize: 11, fontWeight: '800' },
  mouseContainer: { flex: 1, paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  mouseModeRow: { flexDirection: 'row', gap: 8 },
  mouseModePill: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  mouseModeText: { fontSize: 11, fontWeight: '800' },
  touchpadArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
  },
  touchpadStatus: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  touchpadHint: { fontSize: 11, textAlign: 'center' },
  mouseButtonsRow: { flexDirection: 'row', gap: 8 },
  mouseActionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 13,
  },
  mouseActionText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  scrollControlsRow: { flexDirection: 'row', gap: 8 },
  scrollButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 13,
  },
  scrollButtonText: { fontSize: 11, fontWeight: '800' },
});
