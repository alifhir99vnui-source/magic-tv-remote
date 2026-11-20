import React, { useEffect, useRef, useState } from 'react';
import {
  DeviceEventEmitter,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface RemoteExperienceProps {
  activeTab: 'remote' | 'mouse';
  onTabChange: (tab: 'remote' | 'mouse') => void;
  onSendKey: (key: string) => void;
  colors: any;
  mouse: {
    mode: 'touchpad' | 'air';
    setMode: (mode: 'touchpad' | 'air') => void;
    pointerSupported: boolean;
    airSupported: boolean;
    pointerStatus?: string;
    airStatus?: string;
    sensitivity: number;
    setSensitivity: (val: number) => void;
    onTouchpadDelta: (dx: number, dy: number) => void;
    onTouchpadPress: () => void;
    onRightClick?: () => void;
    onRecenter?: () => void;
  };
}

export function RemoteExperience({
  activeTab,
  onTabChange,
  onSendKey,
  mouse,
}: RemoteExperienceProps) {
  const gestureRef = useRef({ x: 0, y: 0, moved: false });
  const mouseRef = useRef(mouse);
  const [cursorDot, setCursorDot] = useState({ x: 0, y: 0 });
  const [expandedPad, setExpandedPad] = useState(false);

  mouseRef.current = mouse;

  useEffect(() => {
    const volumeSubscription = DeviceEventEmitter.addListener(
      'onHardwareVolumeKey',
      (direction: string) => {
        if (direction === 'up') onSendKey('volumeUp');
        if (direction === 'down') onSendKey('volumeDown');
      },
    );

    const gyroSubscription = DeviceEventEmitter.addListener(
      'onGyroDelta',
      (event: { dx: number; dy: number }) => {
        const currentMouse = mouseRef.current;

        if (activeTab !== 'mouse' || currentMouse.mode !== 'air') return;

        const sensitivity = currentMouse.sensitivity || 1;
        setCursorDot((previous) => ({
          x: Math.max(-95, Math.min(95, previous.x + event.dx * sensitivity)),
          y: Math.max(-48, Math.min(48, previous.y + event.dy * sensitivity)),
        }));

        currentMouse.onTouchpadDelta(event.dx, event.dy);
      },
    );

    return () => {
      volumeSubscription.remove();
      gyroSubscription.remove();
    };
  }, [activeTab, mouse.mode, mouse.sensitivity, onSendKey]);

  const touchpadPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        gestureRef.current = { x: 0, y: 0, moved: false };
      },
      onPanResponderMove: (_, gesture) => {
        const dx = gesture.dx - gestureRef.current.x;
        const dy = gesture.dy - gestureRef.current.y;

        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5) {
          gestureRef.current.moved = true;
        }

        if (gestureRef.current.moved && (dx !== 0 || dy !== 0)) {
          setCursorDot((previous) => ({
            x: Math.max(-95, Math.min(95, previous.x + dx * 0.7)),
            y: Math.max(-48, Math.min(48, previous.y + dy * 0.7)),
          }));
          mouseRef.current.onTouchpadDelta(dx, dy);
        }

        gestureRef.current.x = gesture.dx;
        gestureRef.current.y = gesture.dy;
      },
      onPanResponderRelease: () => {
        if (!gestureRef.current.moved) {
          mouseRef.current.onTouchpadPress();
        }
        gestureRef.current = { x: 0, y: 0, moved: false };
      },
      onPanResponderTerminate: () => {
        gestureRef.current = { x: 0, y: 0, moved: false };
      },
    }),
  ).current;

  const selectRemoteMode = () => {
    onTabChange('remote');
    mouse.setMode('touchpad');
  };

  const selectMouseMode = (mode: 'touchpad' | 'air') => {
    onTabChange('mouse');
    mouse.setMode(mode);
  };

  const recenterPointer = () => {
    setCursorDot({ x: 0, y: 0 });
    mouse.onRecenter?.();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topControls}>
        <View style={styles.modeToggleGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'remote' }}
            onPress={selectRemoteMode}
            style={[
              styles.modeButton,
              activeTab === 'remote' && styles.modeButtonActive,
            ]}
          >
            <Ionicons
              name="game-controller-outline"
              size={16}
              color={activeTab === 'remote' ? '#0A1012' : '#94A3B8'}
            />
            <Text
              style={[
                styles.modeButtonText,
                activeTab === 'remote' && styles.modeButtonTextActive,
              ]}
            >
              الريموت
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === 'mouse' }}
            onPress={() => selectMouseMode(mouse.mode)}
            style={[
              styles.modeButton,
              activeTab === 'mouse' && styles.modeButtonActive,
            ]}
          >
            <Ionicons
              name="mouse-outline"
              size={16}
              color={activeTab === 'mouse' ? '#0A1012' : '#94A3B8'}
            />
            <Text
              style={[
                styles.modeButtonText,
                activeTab === 'mouse' && styles.modeButtonTextActive,
              ]}
            >
              الماوس
            </Text>
          </Pressable>
        </View>

        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voice"
            onPress={() => onSendKey('voice')}
            style={styles.quickActionButton}
          >
            <Ionicons name="mic-outline" size={18} color="#7CE3C3" />
            <Text style={styles.quickActionText}>Voice</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الإعدادات"
            onPress={() => onSendKey('settings')}
            style={styles.iconButton}
          >
            <Ionicons name="settings-outline" size={19} color="#7CE3C3" />
          </Pressable>
        </View>
      </View>

      {activeTab === 'mouse' ? (
        <View style={styles.mouseDeck}>
          <View style={styles.mouseHeaderRow}>
            <View style={styles.mouseModeGroup}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mouse.mode === 'touchpad' }}
                disabled={!mouse.pointerSupported}
                onPress={() => selectMouseMode('touchpad')}
                style={[
                  styles.mouseModeButton,
                  mouse.mode === 'touchpad' && styles.mouseModeButtonActive,
                  !mouse.pointerSupported && styles.disabledButton,
                ]}
              >
                <Ionicons
                  name="finger-print-outline"
                  size={15}
                  color={mouse.mode === 'touchpad' ? '#0A1012' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.mouseModeText,
                    mouse.mode === 'touchpad' && styles.mouseModeTextActive,
                  ]}
                >
                  Touchpad
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mouse.mode === 'air' }}
                disabled={!mouse.airSupported}
                onPress={() => selectMouseMode('air')}
                style={[
                  styles.mouseModeButton,
                  mouse.mode === 'air' && styles.mouseModeButtonActive,
                  !mouse.airSupported && styles.disabledButton,
                ]}
              >
                <Ionicons
                  name="compass-outline"
                  size={15}
                  color={mouse.mode === 'air' ? '#0A1012' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.mouseModeText,
                    mouse.mode === 'air' && styles.mouseModeTextActive,
                  ]}
                >
                  Air Mouse
                </Text>
              </Pressable>
            </View>

            <View style={styles.mouseTools}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إعادة توسيط المؤشر"
                onPress={recenterPointer}
                style={styles.toolIconButton}
              >
                <Ionicons name="locate-outline" size={17} color="#7CE3C3" />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expandedPad ? 'تصغير لوحة اللمس' : 'تكبير لوحة اللمس'
                }
                onPress={() => setExpandedPad((expanded) => !expanded)}
                style={styles.toolIconButton}
              >
                <Ionicons
                  name={expandedPad ? 'contract-outline' : 'expand-outline'}
                  size={17}
                  color="#7CE3C3"
                />
              </Pressable>
            </View>
          </View>

          <View
            {...touchpadPanResponder.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={
              mouse.mode === 'air'
                ? 'لوحة تحكم الماوس الهوائي'
                : 'لوحة اللمس: اسحب لتحريك المؤشر واضغط للنقر'
            }
            style={[
              styles.padSurface,
              expandedPad && styles.expandedPadSurface,
            ]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.pointerDot,
                {
                  transform: [
                    { translateX: cursorDot.x },
                    { translateY: cursorDot.y },
                  ],
                },
              ]}
            />
            <Text pointerEvents="none" style={styles.padCaption}>
              {mouse.mode === 'air'
                ? 'حرّك الهاتف لتوجيه المؤشر • اضغط للنقر'
                : 'اسحب لتحريك المؤشر • اضغط للنقر'}
            </Text>
          </View>

          {mouse.mode === 'air' && (
            <Text style={styles.statusText}>
              {mouse.airStatus || 'وضع الماوس الهوائي'}
            </Text>
          )}

          {mouse.mode === 'touchpad' && mouse.pointerStatus ? (
            <Text style={styles.statusText}>{mouse.pointerStatus}</Text>
          ) : null}

          <View style={styles.sensitivityRow}>
            <Text style={styles.sensitivityLabel}>الحساسية</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تقليل حساسية الماوس"
              onPress={() =>
                mouse.setSensitivity(
                  Math.max(0.2, Number((mouse.sensitivity - 0.2).toFixed(1))),
                )
              }
              style={styles.sensitivityButton}
            >
              <Ionicons name="remove" size={18} color="#F8FAFC" />
            </Pressable>
            <Text style={styles.sensitivityValue}>
              {mouse.sensitivity.toFixed(1)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="زيادة حساسية الماوس"
              onPress={() =>
                mouse.setSensitivity(
                  Math.min(3, Number((mouse.sensitivity + 0.2).toFixed(1))),
                )
              }
              style={styles.sensitivityButton}
            >
              <Ionicons name="add" size={18} color="#F8FAFC" />
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.unifiedControlCard}>
            <View style={styles.verticalPill}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="رفع الصوت"
                onPress={() => onSendKey('volumeUp')}
                style={styles.pillHalfButton}
              >
                <Ionicons name="add" size={22} color="#F8FAFC" />
              </Pressable>
              <Text style={styles.pillCenterTag}>VOL</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="خفض الصوت"
                onPress={() => onSendKey('volumeDown')}
                style={styles.pillHalfButton}
              >
                <Ionicons name="remove" size={22} color="#F8FAFC" />
              </Pressable>
            </View>

            <View style={styles.dpadOuter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="أعلى"
                onPress={() => onSendKey('up')}
                style={styles.dpadArrowTop}
              >
                <Ionicons name="chevron-up" size={24} color="#F8FAFC" />
              </Pressable>

              <View style={styles.dpadMidRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="يسار"
                  onPress={() => onSendKey('left')}
                  style={styles.dpadArrowSide}
                >
                  <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="موافق"
                  onPress={() => onSendKey('ok')}
                  style={styles.okButton}
                >
                  <Text style={styles.okButtonLabel}>OK</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="يمين"
                  onPress={() => onSendKey('right')}
                  style={styles.dpadArrowSide}
                >
                  <Ionicons name="chevron-forward" size={24} color="#F8FAFC" />
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="أسفل"
                onPress={() => onSendKey('down')}
                style={styles.dpadArrowBottom}
              >
                <Ionicons name="chevron-down" size={24} color="#F8FAFC" />
              </Pressable>
            </View>

            <View style={styles.verticalPill}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="القناة التالية"
                onPress={() => onSendKey('channelUp')}
                style={styles.pillHalfButton}
              >
                <Ionicons name="chevron-up" size={21} color="#F8FAFC" />
              </Pressable>
              <Text style={styles.pillCenterTag}>CH</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="القناة السابقة"
                onPress={() => onSendKey('channelDown')}
                style={styles.pillHalfButton}
              >
                <Ionicons name="chevron-down" size={21} color="#F8FAFC" />
              </Pressable>
            </View>
          </View>

          <View style={styles.dockRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onSendKey('power')}
              style={[styles.dockButton, styles.powerDockButton]}
            >
              <Ionicons name="power" size={18} color="#FCA5A5" />
              <Text style={[styles.dockText, styles.powerDockText]}>Power</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => onSendKey('back')}
              style={styles.dockButton}
            >
              <Ionicons name="arrow-back" size={18} color="#E2E8F0" />
              <Text style={styles.dockText}>Back</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => onSendKey('home')}
              style={[styles.dockButton, styles.homeDockButton]}
            >
              <Ionicons name="home" size={18} color="#0A1012" />
              <Text style={[styles.dockText, styles.homeDockText]}>Home</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => onSendKey('mute')}
              style={styles.dockButton}
            >
              <Ionicons name="volume-mute" size={18} color="#E2E8F0" />
              <Text style={styles.dockText}>Mute</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => onSendKey('menu')}
              style={styles.dockButton}
            >
              <Ionicons name="apps-outline" size={18} color="#E2E8F0" />
              <Text style={styles.dockText}>Menu</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#11191C',
    borderRadius: 13,
    padding: 3,
    gap: 3,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#7CE3C3',
  },
  modeButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#0A1012',
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  quickActionButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#11191C',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  quickActionText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#11191C',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  mouseDeck: {
    backgroundColor: '#11191C',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  mouseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mouseModeGroup: {
    flexDirection: 'row',
    backgroundColor: '#0A1012',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  mouseModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 9,
  },
  mouseModeButtonActive: {
    backgroundColor: '#7CE3C3',
  },
  disabledButton: {
    opacity: 0.45,
  },
  mouseModeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  mouseModeTextActive: {
    color: '#0A1012',
    fontWeight: '800',
  },
  mouseTools: {
    flexDirection: 'row',
    gap: 6,
  },
  toolIconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#0A1012',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  padSurface: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#0A1012',
    borderWidth: 1,
    borderColor: '#1E2D33',
  },
  expandedPadSurface: {
    height: 220,
  },
  pointerDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7CE3C3',
    opacity: 0.9,
  },
  padCaption: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sensitivityLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  sensitivityButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#172226',
    borderWidth: 1,
    borderColor: '#233137',
  },
  sensitivityValue: {
    minWidth: 28,
    color: '#7CE3C3',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  unifiedControlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11191C',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  verticalPill: {
    width: 50,
    height: 158,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderRadius: 25,
    backgroundColor: '#0A1012',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  pillHalfButton: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCenterTag: {
    color: '#7CE3C3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dpadOuter: {
    width: 172,
    height: 172,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 86,
    backgroundColor: '#0A1012',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dpadArrowTop: {
    width: 52,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadArrowBottom: {
    width: 52,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadMidRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dpadArrowSide: {
    width: 42,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: '#7CE3C3',
  },
  okButtonLabel: {
    color: '#0A1012',
    fontSize: 15,
    fontWeight: '900',
  },
  dockRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dockButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#11191C',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  homeDockButton: {
    backgroundColor: '#7CE3C3',
    borderColor: '#7CE3C3',
  },
  powerDockButton: {
    backgroundColor: '#181115',
    borderColor: '#3F1D24',
  },
  dockText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  homeDockText: {
    color: '#0A1012',
    fontWeight: '800',
  },
  powerDockText: {
    color: '#FCA5A5',
  },
});
