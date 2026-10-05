import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Searching'>;

/**
 * The order is in the open pool for every courier. Moves on by itself when the server says a
 * courier took it (realtime + poll in store/orders.ts), or back home if it was cancelled.
 */
export function SearchingScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const cancel = useOrders((s) => s.cancel);

  useEffect(() => {
    if (!order) return navigation.popToTop(); // the server rejected the order
    if (order.state !== 'ORDER_PLACED' && order.state !== 'CANCELLED') navigation.replace('Track', { orderId });
    if (order.state === 'CANCELLED') navigation.popToTop();
  }, [order?.state, navigation, orderId, order]);

  return (
    <Screen>
      <View style={s.center}>
        <Rings />
        <T kind="h1" style={s.h}>
          Finding a courier
        </T>
        <T kind="caption" style={s.c}>
          Broadcast to everyone online near {order?.pickup ?? 'the pickup'}.
        </T>
        <T kind="state">ORDER_PLACED</T>
      </View>
      <Button title="Go back — we'll tell you when someone's on it" variant="ghost" onPress={() => navigation.popToTop()} />
      <Button title="Cancel order" variant="ghost" onPress={() => cancel(orderId)} />
    </Screen>
  );
}

function Rings() {
  const a = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  const [reduceMotion, setReduceMotion] = useState(true); // still until we know
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  // same rules as the courier: paused off-screen, still with reduce motion (rings stay visible)
  useEffect(() => {
    if (!focused || reduceMotion) {
      a.setValue(0.5);
      return;
    }
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a, focused, reduceMotion]);
  const ring = (delay: number) => {
    const v = Animated.modulo(Animated.add(a, delay), 1);
    return (
      <Animated.View
        key={delay}
        style={[
          s.ring,
          {
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] }) }],
            opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
          },
        ]}
      />
    );
  };
  return (
    <View style={s.rings}>
      {[0, 0.33, 0.66].map(ring)}
      <View style={s.core} />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  rings: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: colors.brandB },
  core: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandA },
  h: { textAlign: 'center' },
  c: { textAlign: 'center', maxWidth: 260 },
});
