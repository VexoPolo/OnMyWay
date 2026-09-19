import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LiveMap } from '../../components/LiveMap';
import { ReportSheet } from '../../components/ReportSheet';
import { T } from '../../components/Text';
import { Timeline } from '../../components/Timeline';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Track'>;

const PROGRESS: Record<string, number> = { AGENT_ASSIGNED: 0.05, PICKED_UP: 0.15, OUT_FOR_DELIVERY: 0.6, ARRIVED: 1 };
const ETA: Record<string, string> = { AGENT_ASSIGNED: '8 min', PICKED_UP: '7 min', OUT_FOR_DELIVERY: '3 min', ARRIVED: 'Here' };
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
        {late && (
          <Pressable onPress={() => setReporting(true)} style={s.banner}>
            <View style={s.bannerDot} />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 13, fontFamily: fonts.bodyMedium }}>Taking longer than usual</T>
              <T kind="caption" style={{ fontSize: 11.5 }}>No update for {sinceMin} min</T>
            </View>
            <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>REPORT ›</T>
          </Pressable>
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
            <Pressable onPress={() => Linking.openURL(`tel:${order.courierPhone}`)} style={s.call}>
              <T kind="mono" style={{ fontSize: 11, color: colors.onBrand }}>CALL</T>
            </Pressable>
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
            placeholder="Add from the Amazon app"
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
        <Pressable onPress={() => setReporting(true)}>
          <T kind="mono" style={s.link}>
            Something wrong?
          </T>
        </Pressable>
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
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandB },
  link: { fontSize: 11, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
  call: { backgroundColor: colors.brandB, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  driverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 4 },
  driverInput: { minWidth: 170, textAlign: 'right', color: colors.ink, fontFamily: fonts.mono, fontSize: 13.5, paddingVertical: 8 },
});
