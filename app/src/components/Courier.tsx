import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** The little courier from the splash. `step` 0..1 swings the legs and arm. */
export function CourierFigure({ step }: { step: Animated.Value }) {
  const legL = step.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '28deg'] });
  const legR = step.interpolate({ inputRange: [0, 1], outputRange: ['28deg', '-28deg'] });
  return (
    <>
      <View style={s.head} />
      <View style={s.body} />
      <Animated.View style={[s.arm, { transform: [{ rotate: legR }, { translateY: 7 }] }]} />
      <View style={s.parcel} />
      <Animated.View style={[s.leg, { transform: [{ rotate: legL }, { translateY: 6 }] }]} />
      <Animated.View style={[s.leg, { transform: [{ rotate: legR }, { translateY: 6 }] }]} />
    </>
  );
}

/** One step cycle (there and back) on the native driver. */
export function walkLoop(step: Animated.Value) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(step, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(step, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]),
  );
}

/** The courier walking in place. Stands still when `active` is false or reduce-motion is on. */
export function WalkingCourier({ active }: { active: boolean }) {
  const step = useRef(new Animated.Value(0.5)).current;
  const [reduceMotion, setReduceMotion] = useState(true); // still until we know
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!active || reduceMotion) {
      step.setValue(0.5); // legs together
      return;
    }
    const loop = walkLoop(step);
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, step]);
  return (
    <View style={s.frame} accessible={false} importantForAccessibility="no-hide-descendants">
      <CourierFigure step={step} />
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: 22, height: 28, alignItems: 'center' },
  head: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.brandA },
  body: { width: 2.4, height: 10, backgroundColor: colors.brandA, borderRadius: 1.2 },
  arm: { position: 'absolute', top: 9, width: 2.2, height: 8, borderRadius: 1.1, backgroundColor: colors.brandA },
  parcel: { position: 'absolute', top: 12, right: -2, width: 6, height: 5, borderRadius: 1, backgroundColor: colors.brandB },
  leg: { position: 'absolute', top: 16, width: 2.4, height: 11, borderRadius: 1.2, backgroundColor: colors.brandA },
});
