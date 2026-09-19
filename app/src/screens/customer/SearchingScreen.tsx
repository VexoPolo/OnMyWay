import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { api } from '../../services/mock';
import { MOCK_COURIER } from '../../services/mockCourier';
import { useOrders } from '../../store/orders';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Searching'>;

/**
 * Broadcast to everyone online. In the demo, if nobody on this device accepts
 * within a few seconds, a mock courier does — so the customer flow always moves.
 */
export function SearchingScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const accept = useOrders((s) => s.accept);
  const cancel = useOrders((s) => s.cancel);

  useEffect(() => {
    // Deliberately not cancelled on unmount: the customer may leave this screen
    // while the broadcast is still out. accept() is a no-op if someone real took it.
    api.findCourier().then(() => accept(orderId, MOCK_COURIER, 'aarav@okaxis'));
  }, [orderId, accept]);

  useEffect(() => {
    if (order && order.state !== 'ORDER_PLACED' && order.state !== 'CANCELLED') {
      navigation.replace('Track', { orderId });
    }
    if (order?.state === 'CANCELLED') navigation.popToTop();
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
      <Button title="Keep searching in the background" variant="ghost" onPress={() => navigation.popToTop()} />
      <Button title="Cancel order" variant="ghost" onPress={() => cancel(orderId)} />
    </Screen>
  );
}

function Rings() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  }, [a]);
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
