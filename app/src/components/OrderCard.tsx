import { Pressable, StyleSheet, View } from 'react-native';
import type { Order } from '../store/types';
import { colors, space } from '../theme';
import { Card } from './Card';
import { T } from './Text';

const SIZE_LABEL = { S: 'Small', M: 'Medium', L: 'Large', XL: 'Extra large' } as const;

export function OrderCard({ order, onPress, taken }: { order: Order; onPress?: () => void; taken?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={[taken && s.taken]}>
        <View style={s.row}>
          <T kind="mono" style={{ color: colors.muted }}>
            {order.id}
          </T>
          <T kind="state">{taken ? 'TAKEN' : order.state}</T>
        </View>
        <Route pickup={order.pickup} dropoff={order.dropoff} />
        <View style={s.row}>
          <T kind="caption">
            {SIZE_LABEL[order.size]} · {order.distanceKm} km
          </T>
          <T kind="subtitle" style={{ color: colors.brandDark }}>
            ₹{order.fare}
          </T>
        </View>
      </Card>
    </Pressable>
  );
}

export function Route({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <View style={s.route}>
      <View style={s.stop}>
        <View style={[s.pin, { backgroundColor: colors.pinPickup }]} />
        <T>{pickup}</T>
      </View>
      <View style={s.leg} />
      <View style={s.stop}>
        <View style={[s.pin, { backgroundColor: colors.pinDrop }]} />
        <T>{dropoff}</T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taken: { opacity: 0.45 },
  route: { gap: 2, paddingVertical: space.xs },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pin: { width: 10, height: 10, borderRadius: 5 },
  leg: { width: 1, height: 14, backgroundColor: colors.line, marginLeft: 4.5 },
});
