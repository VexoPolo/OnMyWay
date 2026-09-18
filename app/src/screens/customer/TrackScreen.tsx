import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LiveMap } from '../../components/LiveMap';
import { T } from '../../components/Text';
import { Timeline } from '../../components/Timeline';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { useMockCourier } from '../../services/mockCourier';
import { colors, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Track'>;

const PROGRESS: Record<string, number> = { AGENT_ASSIGNED: 0.05, PICKED_UP: 0.15, OUT_FOR_DELIVERY: 0.6, ARRIVED: 1 };
const ETA: Record<string, string> = { AGENT_ASSIGNED: '8 min', PICKED_UP: '7 min', OUT_FOR_DELIVERY: '3 min', ARRIVED: 'Here' };

export function TrackScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  useMockCourier(orderId);

  useEffect(() => {
    if (!order) return;
    if (order.state === 'ARRIVED') navigation.replace('Handover', { orderId });
    if (order.state === 'DELIVERED') navigation.replace('Delivered', { orderId });
    if (order.state === 'CANCELLED') navigation.popToTop();
  }, [order?.state, navigation, orderId, order]);

  if (!order) return null;

  return (
    <View style={s.root}>
      <LiveMap pickup={order.pickup} dropoff={order.dropoff} progress={PROGRESS[order.state] ?? 0} />
      <SafeAreaView edges={['top']} style={s.topOverlay} pointerEvents="box-none">
        <View style={s.eta}>
          <T kind="mono" style={{ color: colors.onBrand }}>
            ETA {ETA[order.state] ?? '—'}
          </T>
        </View>
      </SafeAreaView>
      <View style={s.sheet}>
        <View style={s.grip} />
        <View style={s.row}>
          <View style={s.avatar}>
            <T kind="subtitle" style={{ color: colors.onBrand }}>
              {(order.courierRegNo ?? '?').slice(-2)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T kind="subtitle">Courier {order.courierRegNo}</T>
            <T kind="caption">
              {order.pickup} → {order.dropoff} · ₹{order.fare}
            </T>
          </View>
          <T kind="state">{order.state}</T>
        </View>
        <Card style={s.card}>
          <Timeline state={order.state} />
        </Card>
        <Button title="Back to home" variant="ghost" onPress={() => navigation.popToTop()} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  eta: { marginTop: space.sm, backgroundColor: colors.brandA, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  sheet: {
    backgroundColor: colors.ground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: space.md,
    paddingBottom: space.lg,
    gap: space.md,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center' },
  card: { maxHeight: 260 },
});
