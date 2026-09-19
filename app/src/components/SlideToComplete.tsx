import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { T } from './Text';

const H = 60;
const THUMB = 52;
const PAD = 4;

/** Drag the thumb to the end to fire. Springs back if released early. */
export function SlideToComplete({ label = 'Slide to complete', onComplete }: { label?: string; onComplete: () => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const [done, setDone] = useState(false);
  const max = Math.max(0, w - THUMB - PAD * 2);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !done,
      onMoveShouldSetPanResponder: () => !done,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), max)),
      onPanResponderRelease: (_, g) => {
        if (g.dx >= max * 0.85) {
          Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: true }).start(() => {
            setDone(true);
            onComplete();
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    }),
  ).current;

  const labelOpacity = x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillW = x.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [THUMB + PAD * 2, w || 1], extrapolate: 'clamp' });

  return (
    <View style={s.track} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[s.fill, { width: fillW }]} />
      <Animated.Text style={[s.label, { opacity: labelOpacity }]}>{done ? '' : label}</Animated.Text>
      {done && <T style={s.doneLabel}>Completed</T>}
      <Animated.View {...pan.panHandlers} style={[s.thumb, { transform: [{ translateX: x }] }]}>
        <T style={s.chev}>{done ? '✓' : '›'}</T>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: H, borderRadius: H / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: H / 2, backgroundColor: colors.brandB, opacity: 0.9 },
  label: { textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.muted, paddingLeft: THUMB },
  doneLabel: { position: 'absolute', left: 0, right: THUMB, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: colors.onBrand },
  thumb: { position: 'absolute', left: PAD, top: PAD, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.brandA, alignItems: 'center', justifyContent: 'center' },
  chev: { fontSize: 22, fontFamily: fonts.bodySemi, color: colors.onBrand, lineHeight: 26 },
});
