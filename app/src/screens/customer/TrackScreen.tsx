import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ReportSheet } from '../../components/ReportSheet';
import { Screen } from '../../components/Screen';
import { Tap } from '../../components/Tap';
import { T } from '../../components/Text';
import { Timeline } from '../../components/Timeline';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Track'>;

// No GPS on campus: progress is what the courier tapped, said plainly.
const NOW: Record<string, (name: string, pickup: string) => string> = {
  AGENT_ASSIGNED: (n, p) => `${n} is heading to ${p}`,
  PICKED_UP: (n) => `${n} has your parcel`,
  OUT_FOR_DELIVERY: (n) => `${n} is on the way to your block`,
  ARRIVED: (n) => `${n} is at your door`,
};
const LATE_AFTER_MS = 45 * 60_000; // no state change for this long -> nudge to report

export function TrackScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const report = useOrders((s) => s.report);
  const setDriverPhone = useOrders((s) => s.setDriverPhone);
  const [driverPhone, setDriver] = useState<string | null>(null); // null = not editing, show stored value
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!order) return;
    if (order.state === 'ARRIVED') navigation.replace('Handover', { orderId });
    if (order.state === 'CONFIRMATION_RECEIVED' || order.state === 'DELIVERED' || order.state === 'DISPUTED') navigation.replace('Delivered', { orderId });
    if (order.state === 'CANCELLED') navigation.popToTop();
  }, [order?.state, navigation, orderId, order]);

  if (!order) return null;
  const sinceMin = Math.round((Date.now() - order.updatedAt) / 60000);
  const late = Date.now() - order.updatedAt > LATE_AFTER_MS;

  const first = order.courierName?.split(' ')[0] ?? 'Your courier';
  const now = (NOW[order.state] ?? (() => 'Waiting for a courier'))(first, order.pickup);

  return (
    <Screen scroll>
      <View style={s.head}>
        <T kind="eyebrow">Order {order.trackingId ?? ''}</T>
        <T kind="h1" style={{ textTransform: 'none', fontSize: 28, lineHeight: 32 }}>{now}</T>
        <T kind="caption">Then four digits at your door — that's how you know it's yours.</T>
      </View>
      <View style={s.sheet}>
        {late && (
          <Tap onPress={() => setReporting(true)} style={s.banner}>
            <View style={s.bannerDot} />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 13, fontFamily: fonts.bodyMedium }}>Taking longer than usual</T>
              <T kind="caption" style={{ fontSize: 11.5 }}>No update for {sinceMin} min</T>
            </View>
            <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>REPORT ›</T>
          </Tap>
        )}
        <View style={s.row}>
          <View style={s.avatar}>
            <T kind="subtitle" style={{ color: colors.onBrand }}>
              {order.courierName ? order.courierName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : (order.courierRegNo ?? '?').slice(-2)}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T kind="subtitle">{order.courierName ?? `Courier ${order.courierRegNo ?? ''}`}</T>
            <T kind="caption">
              {order.pickup} → {order.dropoff} · ₹{order.fare}
            </T>
          </View>
          {order.courierPhone ? (
            <Tap onPress={() => Linking.openURL(`tel:${order.courierPhone}`)} style={s.call} accessibilityRole="button" accessibilityLabel={`Call ${order.courierName ?? 'courier'}`}>
              <T kind="mono" style={{ fontSize: 11, color: colors.onBrand }}>CALL</T>
            </Tap>
          ) : (
            <T kind="state">{order.state}</T>
          )}
        </View>
        {!!order.courierPhone && (
          <T kind="mono" style={{ fontSize: 12, color: colors.muted, marginTop: -6 }}>
            {order.courierRegNo} · {order.courierPhone}
          </T>
        )}
        <View style={s.driverRow}>
          <T kind="caption" style={{ fontSize: 12.5 }}>Driver's phone</T>
          <TextInput
            value={driverPhone ?? order.driverPhone ?? ''}
            onChangeText={(t) => setDriver(t.replace(/[^\d+ ]/g, ''))}
            onBlur={() => {
              if (driverPhone !== null) setDriverPhone(orderId, driverPhone);
              setDriver(null);
            }}
            placeholder="Add it later"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            maxLength={15}
            style={s.driverInput}
          />
        </View>
        <Card style={s.card}>
          <Timeline state={order.state} />
        </Card>
        <Button title="Back to home" variant="ghost" onPress={() => navigation.popToTop()} />
        <Tap onPress={() => setReporting(true)}>
          <T kind="mono" style={s.link}>
            Something wrong?
          </T>
        </Tap>
      </View>
      <ReportSheet
        open={reporting}
        title="Something wrong?"
        intro={`Order ${order.trackingId ?? order.id} · courier ${order.courierRegNo ?? '—'}. Both reg numbers go to the campus admin with the full timeline.`}
        reasons={['Courier is late', "Courier isn't responding", 'Parcel not received']}
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

const s = StyleSheet.create({
  head: { gap: 6, paddingTop: space.sm },
  sheet: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center' },
  card: {},
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandB },
  link: { fontSize: 11, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
  call: { backgroundColor: colors.brandB, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4 },
  driverInput: { minWidth: 170, textAlign: 'right', color: colors.ink, fontFamily: fonts.mono, fontSize: 13.5, paddingVertical: 8 },
});
