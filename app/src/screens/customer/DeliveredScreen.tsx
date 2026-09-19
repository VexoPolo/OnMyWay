import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ReportSheet } from '../../components/ReportSheet';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Delivered'>;

/** Customer: handover confirmed → pay the courier (cash / their UPI) → rate. Also the DISPUTED view. */
export function DeliveredScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const rate = useOrders((s) => s.rate);
  const report = useOrders((s) => s.report);
  const [reporting, setReporting] = useState(false);

  if (!order) return null;
  const first = order.courierName?.split(' ')[0] ?? order.courierRegNo ?? 'your courier';
  const done = order.state === 'DELIVERED';
  const disputed = order.state === 'DISPUTED';
  const mins = Math.max(1, Math.round((order.updatedAt - order.createdAt) / 60000));

  if (disputed) {
    return (
      <Screen>
        <View style={s.center}>
          <View style={[s.check, { backgroundColor: colors.error }]}>
            <T style={[s.tick, { color: colors.ink }]}>!</T>
          </View>
          <T kind="h1" style={{ textAlign: 'center' }}>
            Reported
          </T>
          <T kind="caption" style={{ textAlign: 'center', maxWidth: 280 }}>
            {order.report?.reason}. The campus admin has both reg numbers and the full timeline.
          </T>
          <T kind="mono" style={{ fontSize: 12, color: colors.error, letterSpacing: 1 }}>
            DISPUTED
          </T>
        </View>
        <Card>
          <Row k="Order" v={order.trackingId ?? order.id} />
          <Row k="Courier" v={order.courierRegNo ?? '—'} />
          <Row k="Reported" v={new Date(order.report?.at ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
        </Card>
        <Button title="Back to home" variant="ghost" onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={[s.center, { flex: 0, paddingTop: space.lg }]}>
        <View style={s.check}>
          <T style={s.tick}>✓</T>
        </View>
        <T kind="h1" style={{ textAlign: 'center' }}>
          {done ? 'Delivered' : 'Handed over'}
        </T>
        <T kind="state">{done ? `DELIVERED · ${mins} min door to door` : 'Pay your courier'}</T>
      </View>

      <Card style={s.pay}>
        <T kind="eyebrow">Pay {first}</T>
        <T style={s.amount}>₹{order.fare}</T>
        <T kind="caption">cash, or UPI</T>
        {order.courierUpi ? (
          <View style={s.upi}>
            <T kind="mono" style={{ fontSize: 15, fontFamily: fonts.monoMedium }}>
              {order.courierUpi}
            </T>
            <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
              UPI ID
            </T>
          </View>
        ) : (
          <T kind="caption" style={{ marginTop: 4 }}>
            No UPI on file for this courier — cash it is.
          </T>
        )}
      </Card>

      <T kind="eyebrow" style={{ textAlign: 'center', marginTop: space.xs }}>
        How was {first}?
      </T>
      <View style={s.stars}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = (order.rating ?? 0) >= n;
          return (
            <Pressable key={n} onPress={() => rate(orderId, n)} style={[s.star, on && s.starOn]}>
              <T style={{ fontSize: 18, color: on ? colors.onBrand : colors.line }}>★</T>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 'auto', gap: 8 }}>
        <Button title="Done" onPress={() => navigation.popToTop()} />
        <Pressable onPress={() => setReporting(true)}>
          <T kind="mono" style={s.link}>
            Something wrong with this delivery?
          </T>
        </Pressable>
      </View>

      <ReportSheet
        open={reporting}
        title="Something wrong?"
        intro={`Order ${order.trackingId ?? order.id} · courier ${order.courierRegNo ?? '—'}. Both reg numbers go to the campus admin with the full timeline.`}
        reasons={['Wrong or damaged parcel', "Courier asked for more than the fare", 'Parcel not received']}
        submitLabel="Report and flag this order"
        footnote="The order is marked DISPUTED on both phones"
        onSubmit={(reason, note) => {
          report(orderId, 'customer', reason, note);
          setReporting(false);
        }}
        onClose={() => setReporting(false)}
      />
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
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  tick: { fontSize: 36, color: colors.onBrand, fontWeight: '700' },
  pay: { alignItems: 'center', gap: 4, paddingVertical: 22 },
  amount: { fontFamily: fonts.displayBlack, fontSize: 52, lineHeight: 56, letterSpacing: -2, color: colors.brandDark },
  upi: { alignSelf: 'stretch', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ground, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14 },
  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  star: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  starOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  link: { fontSize: 11, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
