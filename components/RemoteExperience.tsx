import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  PanResponder,
  ScrollView,
  DeviceEventEmitter,
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
  onTabChange,
  onSendKey,
  mouse,
}: RemoteExperienceProps) {
  const gestureRef = useRef({ x: 0, y: 0, moved: false });
  const [cursorDot, setCursorDot] = useState({ x: 0, y: 0 });
  const [expandedPad, setExpandedPad] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onHardwareVolumeKey', (dir: string) => {
      if (dir === 'up') onSendKey('volumeUp');
      if (dir === 'down') onSendKey('volumeDown');
    });
    const gyroSub = DeviceEventEmitter.addListener('onGyroDelta', (evt: { dx: number; dy: number }) => {
      if (mouse.mode === 'air') {
        const dx = evt.dx * (mouse.sensitivity || 1);
        const dy = evt.dy * (mouse.sensitivity || 1);
        setCursorDot((p) => ({
          x: Math.max(-95, Math.min(95, p.x + dx)),
          y: Math.max(-48, Math.min(48, p.y + dy)),
        }));
        mouse.onTouchpadDelta(dx, dy);
      }
    });
    return () => {
      sub.remove();
      gyroSub.remove();
    };
  }, [mouse.mode, mouse.sensitivity, onSendKey]);

  const touchpadPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureRef.current = { x: 0, y: 0, moved: false };
      },
      onPanResponderMove: (_, gesture) => {
        const dx = gesture.dx - gestureRef.current.x;
        const dy = gesture.dy - gestureRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          gestureRef.current.moved = true;
          setCursorDot((p) => ({
            x: Math.max(-95, Math.min(95, p.x + dx * 0.7)),
            y: Math.max(-48, Math.min(48, p.y + dy * 0.7)),
          }));
          mouse.onTouchpadDelta(dx, dy);
        }
        gestureRef.current.x = gesture.dx;
        gestureRef.current.y = gesture.dy;
      },
      onPanResponderRelease: () => {
        if (!gestureRef.current.moved) {
          mouse.onTouchpadPress();
        }
      },
      onPanResponderTerminate: () => {
        gestureRef.current = { x: 0, y: 0, moved: false };
      },
    })
  ).current;

  const handleRecenter = () => {
    setCursorDot({ x: 0, y: 0 });
    mouse.onRecenter?.();
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* لوحة الماوس + الجيروسكوب الهوائي المندمجة */}
      <View style={styles.mouseDeck}>
        <View style={styles.mouseHeaderRow}>
          <View style={styles.modeToggleGroup}>
            <Pressable
              onPress={() => {
                onTabChange('mouse');
                mouse.setMode('touchpad');
              }}
              style={[styles.modeBtn, mouse.mode === 'touchpad' && styles.modeBtnActive]}
            >
              <Ionicons
                name="finger-print-outline"
                size={14}
                color={mouse.mode === 'touchpad' ? '#0A1012' : '#94A3B8'}
              />
              <Text style={[styles.modeBtnText, mouse.mode === 'touchpad' && styles.modeBtnTextActive]}>
                Touchpad
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onTabChange('mouse');
                mouse.setMode('air');
              }}
              style={[styles.modeBtn, mouse.mode === 'air' && styles.modeBtnActive]}
            >
              <Ionicons
                name="compass-outline"
                size={14}
                color={mouse.mode === 'air' ? '#0A1012' : '#94A3B8'}
              />
              <Text style={[styles.modeBtnText, mouse.mode === 'air' && styles.modeBtnTextActive]}>
                Air Gyro
              </Text>
            </Pressable>
          </View>

          <View style={styles.mouseTools}>
            <Pressable onPress={handleRecenter} style={styles.toolIconBtn}>
              <Ionicons name="locate-outline" size={16} color="#7CE3C3" />
            </Pressable>
            <Pressable onPress={() => setExpandedPad(!expandedPad)} style={styles.toolIconBtn}>
              <Ionicons
                name={expandedPad ? 'contract-outline' : 'expand-outline'}
                size={16}
                color="#7CE3C3"
              />
            </Pressable>
          </View>
        </View>

        <View
          {...touchpadPanResponder.panHandlers}
          style={[styles.padSurface, expandedPad && { height: 175 }]}
        >
          <View
            style={[
              styles.pointerDot,
              { transform: [{ translateX: cursorDot.x }, { translateY: cursorDot.y }] },
            ]}
          />
          <Text style={styles.padCaption}>
            {mouse.mode === 'air'
              ? 'حرّك الهاتف بالهواء لتوجيه المؤشر • اضغط للنقرة'
              : 'اسحب للتحكم بالماوس • اضغط = OK'}
          </Text>
        </View>

        <View style={styles.clickStrip}>
          <Pressable onPress={mouse.onTouchpadPress} style={styles.clickKey}>
            <Text style={styles.clickKeyText}>Left Click / OK</Text>
          </Pressable>
          <Pressable
            onPress={() => (mouse.onRightClick ? mouse.onRightClick() : onSendKey('back'))}
            style={styles.clickKey}
          >
            <Text style={styles.clickKeyText}>Right Click / Back</Text>
          </Pressable>
        </View>
      </View>

      {/* وحدة التحكم المتجانسة: الصوت + الأسهم و OK + القنوات */}
      <View style={styles.unifiedControlCard}>
        <View style={styles.verticalPill}>
          <Pressable onPress={() => onSendKey('volumeUp')} style={styles.pillHalfBtn}>
            <Ionicons name="add" size={22} color="#F8FAFC" />
          </Pressable>
          <Text style={styles.pillCenterTag}>VOL</Text>
          <Pressable onPress={() => onSendKey('volumeDown')} style={styles.pillHalfBtn}>
            <Ionicons name="remove" size={22} color="#F8FAFC" />
          </Pressable>
        </View>

        <View style={styles.dpadOuter}>
          <Pressable onPress={() => onSendKey('up')} style={styles.dpadArrowTop}>
            <Ionicons name="chevron-up" size={24} color="#F8FAFC" />
          </Pressable>
          <View style={styles.dpadMidRow}>
            <Pressable onPress={() => onSendKey('left')} style={styles.dpadArrowSide}>
              <Ionicons name="chevron-back" size={24} color="#F8FAFC" />
            </Pressable>
            <Pressable onPress={() => onSendKey('ok')} style={styles.okButton}>
              <Text style={styles.okButtonLabel}>OK</Text>
            </Pressable>
            <Pressable onPress={() => onSendKey('right')} style={styles.dpadArrowSide}>
              <Ionicons name="chevron-forward" size={24} color="#F8FAFC" />
            </Pressable>
          </View>
          <Pressable onPress={() => onSendKey('down')} style={styles.dpadArrowBottom}>
            <Ionicons name="chevron-down" size={24} color="#F8FAFC" />
          </Pressable>
        </View>

        <View style={styles.verticalPill}>
          <Pressable onPress={() => onSendKey('channelUp')} style={styles.pillHalfBtn}>
            <Ionicons name="chevron-up" size={21} color="#F8FAFC" />
          </Pressable>
          <Text style={styles.pillCenterTag}>CH</Text>
          <Pressable onPress={() => onSendKey('channelDown')} style={styles.pillHalfBtn}>
            <Ionicons name="chevron-down" size={21} color="#F8FAFC" />
          </Pressable>
        </View>
      </View>

      {/* شريط التنقل المندمج */}
      <View style={styles.dockRow}>
        <Pressable onPress={() => onSendKey('power')} style={[styles.dockBtn, styles.powerDockBtn]}>
          <Ionicons name="power" size={18} color="#FCA5A5" />
          <Text style={[styles.dockText, { color: '#FCA5A5' }]}>Power</Text>
        </Pressable>

        <Pressable onPress={() => onSendKey('back')} style={styles.dockBtn}>
          <Ionicons name="arrow-back" size={18} color="#E2E8F0" />
          <Text style={styles.dockText}>Back</Text>
        </Pressable>

        <Pressable onPress={() => onSendKey('home')} style={[styles.dockBtn, styles.homeDockBtn]}>
          <Ionicons name="home" size={18} color="#0A1012" />
          <Text style={[styles.dockText, { color: '#0A1012', fontWeight: '800' }]}>Home</Text>
        </Pressable>

        <Pressable onPress={() => onSendKey('mute')} style={styles.dockBtn}>
          <Ionicons name="volume-mute" size={18} color="#E2E8F0" />
          <Text style={styles.dockText}>Mute</Text>
        </Pressable>

        <Pressable onPress={() => onSendKey('menu')} style={styles.dockBtn}>
          <Ionicons name="apps-outline" size={18} color="#E2E8F0" />
          <Text style={styles.dockText}>Menu</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24, gap: 12 },
  mouseDeck: {
    backgroundColor: '#11191C',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  mouseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#0A1012',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modeBtnActive: { backgroundColor: '#7CE3C3' },
  modeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  modeBtnTextActive: { color: '#0A1012', fontWeight: '800' },
  mouseTools: { flexDirection: 'row', gap: 6 },
  toolIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0A1012',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  padSurface: {
    height: 110,
    backgroundColor: '#0A1012',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2D33',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pointerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#7CE3C3',
    position: 'absolute',
    opacity: 0.9,
  },
  padCaption: { color: '#64748B', fontSize: 11, textAlign: 'center', paddingHorizontal: 12 },
  clickStrip: { flexDirection: 'row', gap: 8 },
  clickKey: {
    flex: 1,
    backgroundColor: '#172226',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233137',
  },
  clickKeyText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
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
    width: 54,
    height: 168,
    borderRadius: 27,
    backgroundColor: '#0A1012',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  pillHalfBtn: { width: 46, height: 50, alignItems: 'center', justifyContent: 'center' },
  pillCenterTag: { color: '#7CE3C3', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dpadOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: '#0A1012',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dpadArrowTop: { width: 52, height: 42, alignItems: 'center', justifyContent: 'center' },
  dpadArrowBottom: { width: 52, height: 42, alignItems: 'center', justifyContent: 'center' },
  dpadMidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  dpadArrowSide: { width: 42, height: 52, alignItems: 'center', justifyContent: 'center' },
  okButton: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#7CE3C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  okButtonLabel: { color: '#0A1012', fontSize: 15, fontWeight: '900' },
  dockRow: { flexDirection: 'row', gap: 6 },
  dockBtn: {
    flex: 1,
    backgroundColor: '#11191C',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  homeDockBtn: { backgroundColor: '#7CE3C3', borderColor: '#7CE3C3' },
  powerDockBtn: { borderColor: '#3F1D24', backgroundColor: '#181115' },
  dockText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
});
