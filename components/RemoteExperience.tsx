import React, { useMemo, useRef } from 'react';
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

export type RemoteMouseMode = 'pointer' | 'swipe' | 'air';

export interface RemoteMouseController {
  mode: RemoteMouseMode;
  setMode: (mode: RemoteMouseMode) => void;
  pointerSupported: boolean;
  airSupported: boolean;
  pointerStatus: string;
  airStatus: string;
  sensitivity: number;
  scrollInverted: boolean;
  onToggleScrollInverted: () => void;
  onTouchpadDelta: (dx: number, dy: number) => void;
  onTouchpadPress: () => void;
  onRightClick: () => void;
  onRecenter: () => void;
  onScroll: (deltaY: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSwipe: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onConfirm: () => void;
}

interface RemoteExperienceProps {
  activeTab: 'remote' | 'mouse';
  onTabChange: (tab: 'remote' | 'mouse') => void;
  onSendKey: (key: string) => void;
  onOpenKeyboard?: () => void;
  onOpenApps?: () => void;
  onVoiceSearch?: () => void;
  onTvSettings?: () => void;
  onOpenShare?: () => void;
  onPressFeedback?: () => void;
  t: (key: TranslationKey) => string;
  colors: RemoteExperienceColors;
  isConnected: boolean;
  deviceName: string;
  mouse: RemoteMouseController;
}

function RemoteExperienceComponent({
  activeTab,
  onTabChange,
  onSendKey,
  onOpenKeyboard,
  onOpenApps,
  onVoiceSearch,
  onTvSettings,
  onOpenShare,
  onPressFeedback,
  t,
  colors,
  isConnected,
  deviceName,
  mouse,
}: RemoteExperienceProps) {
  const touchRef = useRef<{
    x: number;
    y: number;
    startedAt: number;
    totalX: number;
    totalY: number;
    moved: boolean;
    twoFinger: boolean;
  } | null>(null);
  const accent = colors.accent;

  const touchpadResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          touchRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
            startedAt: Date.now(),
            totalX: 0,
            totalY: 0,
            moved: false,
            twoFinger: false,
          };
        },
        onPanResponderMove: (event) => {
          const current = touchRef.current;
          if (!current) return;
          const x = event.nativeEvent.pageX;
          const y = event.nativeEvent.pageY;
          const dx = x - current.x;
          const dy = y - current.y;
          const touches = event.nativeEvent.touches?.length ?? 1;
          current.totalX += dx;
          current.totalY += dy;

          if (touches >= 2) {
            current.twoFinger = true;
            current.moved = true;
            mouse.onScroll(mouse.scrollInverted ? dy : -dy);
          } else if (mouse.mode === 'pointer') {
            if (!current.moved && Math.abs(dx) + Math.abs(dy) > 2) {
              current.moved = true;
              mouse.onDragStart();
            }
            if (current.moved) mouse.onTouchpadDelta(dx, dy);
          } else if (Math.abs(dx) + Math.abs(dy) > 2) {
            current.moved = true;
          }

          current.x = x;
          current.y = y;
        },
        onPanResponderRelease: () => {
          const current = touchRef.current;
          touchRef.current = null;
          if (!current) return;
          const duration = Date.now() - current.startedAt;

          if (mouse.mode === 'swipe' && !current.twoFinger) {
            if (Math.max(Math.abs(current.totalX), Math.abs(current.totalY)) > 40) {
              if (Math.abs(current.totalX) > Math.abs(current.totalY)) {
                mouse.onSwipe(current.totalX > 0 ? 'right' : 'left');
              } else {
                mouse.onSwipe(current.totalY > 0 ? 'down' : 'up');
              }
            } else if (!current.moved && duration < 350) {
              mouse.onConfirm();
            }
            return;
          }

          if (current.moved && !current.twoFinger) {
            mouse.onDragEnd();
          } else if (!current.moved && duration >= 450) {
            mouse.onRightClick();
          } else if (!current.moved) {
            mouse.onTouchpadPress();
          }
        },
        onPanResponderTerminate: () => {
          const current = touchRef.current;
          touchRef.current = null;
          if (current?.moved && !current.twoFinger && mouse.mode === 'pointer') {
            mouse.onDragEnd();
          }
        },
      }),
    [mouse],
  );

  const circularButton = (
    key: string,
    label: TranslationKey,
    icon: keyof typeof Ionicons.glyphMap,
    action: () => void,
    active = false,
    disabled = false,
    large = false,
  ) => (
    <Pressable
      onPressIn={onPressFeedback}
      key={key}
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      disabled={disabled}
      onPress={action}
      style={[
        large ? styles.largeCircleButton : styles.circleButton,
        {
          backgroundColor: active ? colors.accentSoft : colors.card,
          borderColor: active ? accent : colors.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={large ? 27 : 19}
        color={active || !disabled ? accent : colors.secondary}
      />
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
      onPressIn={onPressFeedback}
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
      onPressIn={onPressFeedback}
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
          style={styles.tabScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.remoteTopRow}>
            <Pressable
      onPressIn={onPressFeedback}
              accessibilityRole="button"
              accessibilityLabel={t('power')}
              onPress={() => onSendKey('power')}
              style={[styles.circleButton, styles.powerButton]}
            >
              <Ionicons name="power" size={21} color="#F87171" />
            </Pressable>
            {circularButton('source', 'source', 'tv-outline', () =>
              onSendKey('source'),
            )}
            {circularButton('mute', 'mute', 'volume-mute-outline', () =>
              onSendKey('mute'),
            )}
            {circularButton('keyboard', 'keyboard', 'keypad-outline', () =>
              onOpenKeyboard?.(),
            )}
          </View>

          <View style={styles.settingsRow}>
            {circularButton('tvSettings', 'tvSettings', 'settings-outline', () => {
              if (onTvSettings) onTvSettings();
              else onSendKey('settings');
            })}
          </View>

          <View
            style={[
              styles.dpadOuter,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
      onPressIn={onPressFeedback}
              accessibilityRole="button"
              accessibilityLabel={t('up')}
              onPress={() => onSendKey('up')}
              style={styles.dpadTop}
            >
              <Ionicons name="chevron-up" size={26} color={colors.text} />
            </Pressable>
            <View style={styles.dpadMiddleRow}>
              <Pressable
      onPressIn={onPressFeedback}
                accessibilityRole="button"
                accessibilityLabel={t('left')}
                onPress={() => onSendKey('left')}
                style={styles.dpadSide}
              >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </Pressable>
              <Pressable
      onPressIn={onPressFeedback}
                accessibilityRole="button"
                accessibilityLabel={t('ok')}
                onPress={() => onSendKey('ok')}
                style={[styles.okButton, { backgroundColor: accent }]}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </Pressable>
              <Pressable
      onPressIn={onPressFeedback}
                accessibilityRole="button"
                accessibilityLabel={t('right')}
                onPress={() => onSendKey('right')}
                style={styles.dpadSide}
              >
                <Ionicons name="chevron-forward" size={26} color={colors.text} />
              </Pressable>
            </View>
            <Pressable
      onPressIn={onPressFeedback}
              accessibilityRole="button"
              accessibilityLabel={t('down')}
              onPress={() => onSendKey('down')}
              style={styles.dpadBottom}
            >
              <Ionicons name="chevron-down" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.navRow}>
            {(
              [
                ['back', 'back', 'arrow-back-outline'],
                ['home', 'home', 'home-outline'],
                ['menu', 'menu', 'menu-outline'],
                ['recents', 'recentApps', 'albums-outline'],
              ] as Array<[string, TranslationKey, keyof typeof Ionicons.glyphMap]>
            ).map(([key, label, icon]) => (
              <Pressable
      onPressIn={onPressFeedback}
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(label)}
                onPress={() => onSendKey(key)}
                style={[
                  styles.navPill,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name={icon} size={17} color={colors.text} />
                <Text style={[styles.navPillText, { color: colors.text }]}>
                  {t(label)}
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
      onPressIn={onPressFeedback}
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
      onPressIn={onPressFeedback}
                accessibilityRole="button"
                accessibilityLabel={t('volumeDown')}
                onPress={() => onSendKey('volumeDown')}
                style={styles.rockerHalf}
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Pressable
      onPressIn={onPressFeedback}
              accessibilityRole="button"
              accessibilityLabel={t('voiceSearch')}
              onPress={onVoiceSearch ?? (() => onSendKey('voice'))}
              style={[
                styles.voiceButton,
                { backgroundColor: colors.accentSoft, borderColor: accent },
              ]}
            >
              <Ionicons name="mic-outline" size={24} color={accent} />
              <Text style={[styles.voiceLabel, { color: accent }]}>
                {t('voiceSearch')}
              </Text>
            </Pressable>

            <View
              style={[
                styles.rockerCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
      onPressIn={onPressFeedback}
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
      onPressIn={onPressFeedback}
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
            {(
              [
                ['rewind', 'rewind', 'play-skip-back-outline'],
                ['playPause', 'playPause', 'pause-circle-outline'],
                ['forward', 'forward', 'play-skip-forward-outline'],
                ['source', 'source', 'tv-outline'],
              ] as Array<[string, TranslationKey, keyof typeof Ionicons.glyphMap]>
            ).map(([key, label, icon]) => (
              <Pressable
      onPressIn={onPressFeedback}
                key={key}
                accessibilityRole="button"
                accessibilityLabel={t(label)}
                onPress={() => onSendKey(key)}
                style={[
                  styles.mediaButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name={icon} size={18} color={accent} />
                <Text style={[styles.mediaButtonText, { color: colors.text }]}>
                  {t(label)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={styles.mouseContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.toolsRow}>
            {circularButton('tvSettings', 'tvSettings', 'settings-outline', () => {
              if (onTvSettings) onTvSettings();
              else onSendKey('settings');
            })}
            {circularButton('apps', 'fetchApps', 'apps-outline', () =>
              onOpenApps?.(),
            )}
            {circularButton('cast', 'cast', 'tv-outline', () =>
              onSendKey('source'),
            )}
            {circularButton('voice', 'voiceSearch', 'mic-outline', () =>
              onVoiceSearch?.(),
            )}
            {circularButton('share', 'share', 'link-outline', () =>
              onOpenShare?.(),
            )}
            {circularButton('search', 'search', 'search-outline', () =>
              onSendKey('search'),
            )}
          </View>

          <View style={styles.touchpadShell}>
            <Pressable
      onPressIn={onPressFeedback}
              accessibilityRole="button"
              accessibilityLabel={t('invertScroll')}
              onPress={mouse.onToggleScrollInverted}
              style={[
                styles.invertButton,
                {
                  backgroundColor: colors.card,
                  borderColor: mouse.scrollInverted ? accent : colors.border,
                },
              ]}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={16}
                color={mouse.scrollInverted ? accent : colors.text}
              />
            </Pressable>
            <View
              {...touchpadResponder.panHandlers}
              style={[
                styles.touchpadArea,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
            </View>
          </View>

          <View style={styles.modeBar}>
            <View style={styles.modeCluster}>
              {circularButton('recenter', 'recenter', 'locate-outline', mouse.onRecenter)}
              {circularButton(
                'pointer',
                'pointerMode',
                'navigate-outline',
                () => mouse.setMode('pointer'),
                mouse.mode === 'pointer',
              )}
            </View>
            <View
              style={[
                styles.devicePill,
                { backgroundColor: colors.cardAlt, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: isConnected ? accent : colors.secondary },
                ]}
              />
              <Text style={[styles.devicePillText, { color: colors.text }]} numberOfLines={1}>
                {deviceName}
              </Text>
            </View>
            <View style={styles.modeCluster}>
              {circularButton(
                'swipe',
                'swipeMode',
                'swap-horizontal-outline',
                () => mouse.setMode('swipe'),
                mouse.mode === 'swipe',
              )}
              {circularButton(
                'air',
                mouse.airSupported ? 'airMouse' : 'airUnavailable',
                'navigate-circle-outline',
                () => mouse.setMode('air'),
                mouse.mode === 'air',
                !mouse.airSupported,
              )}
            </View>
          </View>

          <View style={styles.navigationRow}>
            {circularButton('pageUp', 'pageUp', 'chevron-up', () =>
              onSendKey('pageUp'),
            )}
            {circularButton('pageDown', 'pageDown', 'chevron-down', () =>
              onSendKey('pageDown'),
            )}
            {circularButton('back', 'back', 'arrow-back-outline', () =>
              onSendKey('back'),
              false,
              false,
              true,
            )}
            {circularButton('recents', 'recentApps', 'albums-outline', () =>
              onSendKey('recents'),
            )}
            {circularButton('home', 'home', 'home-outline', () =>
              onSendKey('home'),
            )}
          </View>

          <View style={styles.quickRow}>
            {circularButton('volumeDown', 'volumeDown', 'remove', () =>
              onSendKey('volumeDown'),
            )}
            {circularButton('volumeUp', 'volumeUp', 'add', () =>
              onSendKey('volumeUp'),
            )}
            {circularButton('keyboard', 'keyboard', 'keypad-outline', () =>
              onOpenKeyboard?.(),
            )}
            {circularButton('power', 'power', 'power', () => onSendKey('power'))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export const RemoteExperience = React.memo(RemoteExperienceComponent);

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
  tabScroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  remoteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  circleButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 23,
  },
  largeCircleButton: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 31,
  },
  powerButton: { backgroundColor: '#2A1215', borderColor: '#7F1D1D' },
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
  mouseContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  toolsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  touchpadShell: { position: 'relative', minHeight: 230 },
  invertButton: {
    position: 'absolute',
    zIndex: 2,
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
  },
  touchpadArea: {
    flex: 1,
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
  },
  touchpadStatus: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  touchpadHint: { fontSize: 11, textAlign: 'center' },
  scrollModeText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  modeBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  modeCluster: { flexDirection: 'row', gap: 6 },
  devicePill: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  devicePillText: { flex: 1, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  navigationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
