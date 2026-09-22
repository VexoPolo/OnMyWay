import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { PinGlyph } from '../../components/Glyphs';
import { Screen } from '../../components/Screen';
import { Tap } from '../../components/Tap';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useAuth } from '../../store/auth';
import { useOrders } from '../../store/orders';
import type { Order } from '../../store/types';
import { colors, fonts, radius, space } from '../../theme';

const STEP: Record<string, string> = {
  AGENT_ASSIGNED: 'Collect it',
  PICKED_UP: 'Start walking',
  OUT_FOR_DELIVERY: 'On the way',
  ARRIVED: 'At the door',
  CONFIRMATION_RECEIVED: 'Take the cash',
  DELIVERED: 'Done',
  DISPUTED: 'Reported',
};
const DONE = new Set(['DELIVERED', 'DISPUTED']);
/** A run is one walk, not a career: finished parcels drop off the list after this. */
const RUN_WINDOW = 2 * 3600_000;

/** The run: every parcel this courier is carrying right now, in one list. */
export function RunScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const me = useAuth((s) => s.user)!;
  const orders = useOrders((s) => s.orders);

  const mine = Object.values(orders)
    .filter((o) => o.courierRegNo === me.regNo && o.state !== 'ORDER_PLACED' && o.state !== 'CANCELLED')
    .filter((o) => !DONE.has(o.state) || Date.now() - o.updatedAt < RUN_WINDOW)
    .sort((a, b) => a.createdAt - b.createdAt);
  const left = mine.filter((o) => !DONE.has(o.state));
  const done = mine.length - left.length;
  const earn = mine.reduce((sum, o) => sum + o.fare, 0);

  return (
    <Screen scroll>
      <T kind="h1" style={s.h1}>Your run</T>
      <T kind="caption" style={s.sub}>
        {left.length === 0
          ? `All ${mine.length} delivered. ₹${earn} in hand.`
          : `${done} of ${mine.length} delivered · ₹${earn} for the run`}
      </T>

      <View style={s.bar}>
        {mine.map((o) => (
          <View key={o.id} style={[s.pip, DONE.has(o.state) && s.pipDone]} />
        ))}
      </View>

      <View style={s.list}>
        {mine.map((o, i) => (
          <Stop key={o.id} order={o} n={i + 1} onPress={() => nav.navigate('CourierJob', { orderId: o.id, point: o.pickup })} />
        ))}
      </View>

      {left.length > 0 && (
        <Button
          title={`Next stop: ${left[0].dropoff} →`}
          onPress={() => nav.navigate('CourierJob', { orderId: left[0].id, point: left[0].pickup })}
          style={{ marginTop: space.sm }}
        />
      )}
      <Button title="Back to the gate" variant="ghost" onPress={() => nav.navigate('Tabs', { screen: 'Home' })} />
    </Screen>
  );
}

function Stop({ order, n, onPress }: { order: Order; n: number; onPress: () => void }) {
  const done = DONE.has(order.state);
  return (
    <Tap onPress={onPress} style={[s.stop, done && s.stopDone]} accessibilityLabel={`Stop ${n}, ${order.dropoff}, ${STEP[order.state] ?? order.state}`}>
      <View style={[s.num, done && s.numDone]}>
        {done ? <T style={{ fontSize: 13, color: colors.onBrand }}>✓</T> : <PinGlyph size={18} color={colors.onBrand} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontSize: 14, fontFamily: fonts.bodySemi }}>{order.dropoff}</T>
        <T kind="caption" style={{ fontSize: 11.5 }}>
          {order.trackingId ?? `Parcel for ${order.customerName?.split(' ')[0] ?? order.customerRegNo}`}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <T kind="mono" style={{ fontSize: 10.5, color: done ? colors.muted : colors.brandDark }}>{STEP[order.state] ?? order.state}</T>
        <T kind="caption" style={{ fontSize: 11.5 }}>₹{order.fare}</T>
      </View>
    </Tap>
  );
}

const s = StyleSheet.create({
  h1: { fontSize: 26, lineHeight: 29, textTransform: 'none', letterSpacing: -0.5, paddingTop: space.sm },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: -space.sm },
  bar: { flexDirection: 'row', gap: 6, marginTop: space.xs },
  pip: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.line },
  pipDone: { backgroundColor: colors.brandB },
  list: { gap: space.sm, marginTop: space.sm },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  stopDone: { opacity: 0.55 },
  num: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center' },
  numDone: { backgroundColor: colors.muted },
});
