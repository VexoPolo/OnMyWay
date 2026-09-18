import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Delivered'>;

export function DeliveredScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);

  if (!order) return null;
  const mins = Math.max(1, Math.round((order.updatedAt - order.createdAt) / 60000));

  return (
    <Screen>
      <View style={s.center}>
        <View style={s.check}>
          <T style={s.tick}>✓</T>
        </View>
        <T kind="h1" style={{ textAlign: 'center' }}>
          Delivered
        </T>
        <T kind="caption" style={{ textAlign: 'center' }}>
          {mins} min from order to door.
        </T>
        <T kind="state">DELIVERED · order closed</T>
      </View>
      <Card>
        <Row k="Order" v={order.id} />
        <Row k="Route" v={`${order.pickup} → ${order.dropoff}`} />
        <Row k="Courier" v={order.courierRegNo ?? '—'} />
        <Row k="Fare" v={`₹${order.fare}`} />
      </Card>
      <Button title="Done" onPress={() => navigation.popToTop()} />
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <T kind="caption">{k}</T>
      <T kind="mono">{v}</T>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandB,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  tick: { fontSize: 44, color: colors.onBrand, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
