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
}

interface RemoteExperienceProps {
  activeTab: 'remote' | 'mouse';
  onTabChange: (tab: 'remote' | 'mouse') => void;
  onSendKey: (key: string) => void;
  onOpenSettings?: () => void;
  colors: RemoteExperienceColors;
  isConnected: boolean;
  apps: RemoteAppShortcut[];
  onLaunchApp: (packageName: string) => void;
  mouse: RemoteMouseController;
}

const ACCENT = '#7CE3C3';

export function RemoteExperience({
  activeTab,
  onTabChange,
  onSendKey,
  onOpenSettings,
  colors,
  apps,
  onLaunchApp,
  mouse,
}: RemoteExperienceProps) {
  const [keypadVisible, setKeypadVisible] = useState(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

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
        },
        onPanResponderMove: (evt) => {
          if (!lastTouchRef.current) return;
          const dx =
            (evt.nativeEvent.pageX - lastTouchRef.current.x) *
            mouse.sensitivity;
          const dy =
            (evt.nativeEvent.pageY - lastTouchRef.current.y) *
            mouse.sensitivity;

          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            movedRef.current = true;
            mouse.onTouchpadDelta(dx, dy);
            lastTouchRef.current = {
              x: evt.nativeEvent.pageX,
              y: evt.nativeEvent.pageY,
            };
          }
        },
        onPanResponderRelease: () => {
          if (!movedRef.current) {
            mouse.onTouchpadPress();
          }
          lastTouchRef.current = null;
          movedRef.current = false;
        },
      }),
    [mouse],
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
              backgroundColor: colors.cardAlt,
              borderColor: ACCENT,
            },
          ]}
        >
          <Ionicons
            name="keypad-outline"
            size={16}
            color={activeTab === 'remote' ? ACCENT : colors.secondary}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: activeTab === 'remote' ? ACCENT : colors.secondary },
            ]}
          >
            الأزرار
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === 'mouse' }}
          onPress={() => onTabChange('mouse')}
          style={[
            styles.modeButton,
            activeTab === 'mouse' && {
              backgroundColor: colors.cardAlt,
              borderColor: ACCENT,
            },
          ]}
        >
          <Ionicons
            name="hand-left-outline"
            size={16}
            color={activeTab === 'mouse' ? ACCENT : colors.secondary}
          />
          <Text
            style={[
              styles.modeButtonText,
              { color: activeTab === 'mouse' ? ACCENT : colors.secondary },
            ]}
          >
            الماوس
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
              accessibilityLabel="طاقة"
              onPress={() => onSendKey('power')}
              style={[styles.powerButton, { borderColor: '#7F1D1D' }]}
            >
              <Ionicons name="power" size={21} color="#F87171" />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="كتم الصوت"
              onPress={() => onSendKey('mute')}
              style={[
                styles.circleActionButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="volume-mute-outline"
                size={20}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="معلومات"
              onPress={() => onSendKey('info')}
              style={[
                styles.circleActionButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.text}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="لوحة الأرقام"
              onPress={() => setKeypadVisible((v) => !v)}
              style={[
                styles.circleActionButton,
                {
                  backgroundColor: keypadVisible
                    ? colors.cardAlt
                    : colors.card,
                  borderColor: keypadVisible ? ACCENT : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.numpadToggleText,
                  { color: keypadVisible ? ACCENT : colors.text },
                ]}
              >
                123
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الإعدادات"
              onPress={onOpenSettings}
              style={[
                styles.circleActionButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={colors.text}
              />
            </Pressable>
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
                  {row.map((item) => {
                    const isDigit = /^[0-9]$/.test(item);
                    const keyName = isDigit ? `num${item}` : item;
                    return (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        onPress={() => onSendKey(keyName)}
                        style={[
                          styles.numpadKey,
                          {
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.numpadKeyText, { color: colors.text }]}
                        >
                          {item === 'menu'
                            ? 'MENU'
                            : item === 'back'
                              ? 'DEL'
                              : item}
                        </Text>
                      </Pressable>
                    );
                  })}
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
              accessibilityLabel="أعلى"
              onPress={() => onSendKey('up')}
              style={styles.dpadTop}
            >
              <Ionicons name="chevron-up" size={26} color={colors.text} />
            </Pressable>

            <View style={styles.dpadMiddleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="يسار"
                onPress={() => onSendKey('left')}
                style={styles.dpadSide}
              >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="موافق"
                onPress={() => onSendKey('ok')}
                style={[styles.okButton, { backgroundColor: ACCENT }]}
              >
                <Text style={styles.okButtonText}>OK</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="يمين"
                onPress={() => onSendKey('right')}
                style={styles.dpadSide}
              >
                <Ionicons
                  name="chevron-forward"
                  size={26}
                  color={colors.text}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="أسفل"
              onPress={() => onSendKey('down')}
              style={styles.dpadBottom}
            >
              <Ionicons name="chevron-down" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              onPress={() => onSendKey('back')}
              style={[
                styles.navPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="arrow-back" size={19} color={colors.text} />
              <Text style={[styles.navPillText, { color: colors.text }]}>
                رجوع
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="الرئيسية"
              onPress={() => onSendKey('home')}
              style={[
                styles.navPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="home-outline" size={19} color={ACCENT} />
              <Text style={[styles.navPillText, { color: colors.text }]}>
                الرئيسية
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="القائمة"
              onPress={() => onSendKey('menu')}
              style={[
                styles.navPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="menu-outline" size={19} color={colors.text} />
              <Text style={[styles.navPillText, { color: colors.text }]}>
                القائمة
              </Text>
            </Pressable>
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
                accessibilityLabel="رفع الصوت"
                onPress={() => onSendKey('volumeUp')}
                style={styles.rockerHalf}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.rockerLabel, { color: colors.secondary }]}>
                VOL
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="خفض الصوت"
                onPress={() => onSendKey('volumeDown')}
                style={styles.rockerHalf}
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="البحث الصوتي"
              onPress={() => onSendKey('voice')}
              style={[
                styles.voiceButton,
                { backgroundColor: colors.cardAlt, borderColor: ACCENT },
              ]}
            >
              <Ionicons name="mic-outline" size={24} color={ACCENT} />
              <Text style={[styles.voiceLabel, { color: ACCENT }]}>صوت</Text>
            </Pressable>

            <View
              style={[
                styles.rockerCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="القناة التالية"
                onPress={() => onSendKey('channelUp')}
                style={styles.rockerHalf}
              >
                <Ionicons name="chevron-up" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.rockerLabel, { color: colors.secondary }]}>
                CH
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="القناة السابقة"
                onPress={() => onSendKey('channelDown')}
                style={styles.rockerHalf}
              >
                <Ionicons name="chevron-down" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={styles.appsSection}>
            <Text style={[styles.appsTitle, { color: colors.secondary }]}>
              التطبيقات السريعة (Bluetooth HID)
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
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={app.icon} size={18} color={ACCENT} />
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
          <View
            {...touchpadResponder.panHandlers}
            style={[
              styles.touchpadArea,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={
                mouse.mode === 'air'
                  ? 'navigate-circle-outline'
                  : 'finger-print-outline'
              }
              size={34}
              color={ACCENT}
            />
            <Text style={[styles.touchpadStatus, { color: colors.text }]}>
              {mouse.mode === 'air' ? mouse.airStatus : mouse.pointerStatus}
            </Text>
            <Text style={[styles.touchpadHint, { color: colors.secondary }]}>
              اسحب لتحريك المؤشر · اضغط للنقر
            </Text>
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
                تمرير لأعلى
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
                تمرير لأسفل
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  modeButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 12,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  powerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A1215',
    borderWidth: 1,
    borderRadius: 24,
  },
  circleActionButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 24,
  },
  numpadToggleText: {
    fontSize: 12,
    fontWeight: '900',
  },
  numpadCard: {
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderRadius: 18,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numpadKey: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  numpadKeyText: {
    fontSize: 13,
    fontWeight: '800',
  },
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
  dpadTop: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadMiddleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dpadSide: {
    width: 44,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okButton: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 37,
  },
  okButtonText: {
    color: '#0A1012',
    fontSize: 16,
    fontWeight: '900',
  },
  dpadBottom: {
    width: 64,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navPill: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  navPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  rockersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rockerCard: {
    flex: 1,
    height: 112,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 22,
  },
  rockerHalf: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rockerLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  voiceButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 36,
  },
  voiceLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  appsSection: {
    gap: 6,
  },
  appsTitle: {
    fontSize: 10,
    fontWeight: '800',
  },
  appsRow: {
    gap: 8,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 14,
  },
  appChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mouseContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  mouseModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mouseModePill: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  mouseModeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  touchpadArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
  },
  touchpadStatus: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  touchpadHint: {
    fontSize: 11,
    textAlign: 'center',
  },
  mouseButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mouseActionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 13,
  },
  mouseActionText: {
    fontSize: 11,
    fontWeight: '800',
  },
  scrollControlsRow: {
    flexDirection: 'row',
    gap: 8,
  },
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
  scrollButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
