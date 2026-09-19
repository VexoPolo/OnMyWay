import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OtpInput } from '../../components/OtpInput';
import { ReportSheet } from '../../components/ReportSheet';
import { SlideToComplete } from '../../components/SlideToComplete';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import { Timeline } from '../../components/Timeline';
import type { AppStackParams } from '../../navigation/types';
import { useAuth } from '../../store/auth';
import { useOrders } from '../../store/orders';
import type { Order } from '../../store/types';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'CourierJob'>;

const POINTS = ['Main Gate', 'Amazon Pick Up Point'] as const;
const SIZE_LABEL = { S: 'Regular', M: 'Regular', L: 'Large', XL: 'Large' } as const;
// ponytail: driver details come from the delivery platform; mocked until that integration exists

const CHIP: Record<string, string> = {
  ORDER_PLACED: 'Open order',
  AGENT_ASSIGNED: 'Order accepted',
  PICKED_UP: 'Parcel collected',
  OUT_FOR_DELIVERY: 'On the way',
  ARRIVED: 'At the door',
  CONFIRMATION_RECEIVED: 'Handover verified',
  DELIVERED: 'Delivered',
  DISPUTED: 'Disputed',
};

/** Frame 4 — Delivery Agent · Pickup. Where are you, order details, request the platform OTP. */
export function CourierJobScreen({ navigation, route }: Props) {
  const { orderId, point: fromHub } = route.params;
  const me = useAuth((s) => s.user)!;
  const order = useOrders((s) => s.orders[orderId]);
  const accept = useOrders((s) => s.accept);
  const advance = useOrders((s) => s.advance);
  const arrive = useOrders((s) => s.arrive);
  const confirm = useOrders((s) => s.confirmHandover);
  const report = useOrders((s) => s.report);
  const [reporting, setReporting] = useState(false);

  const [point, setPoint] = useState<(typeof POINTS)[number]>(fromHub === 'Amazon Pick Up Point' ? 'Amazon Pick Up Point' : 'Main Gate');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string>();

  if (!order) return null;
  const mine = order.courierRegNo === me.regNo;
  const first = order.customerName?.split(' ')[0] ?? 'the customer';

  const onAccept = async () => {
    const r = await accept(orderId, me.regNo, me.upi);
    if (r === 'taken') setMsg('Someone else got there first. This job is taken.');
    else if (r === 'offline') setMsg("Can't reach the server — try again.");
  };
  const onVerify = async () => {
    const r = await confirm(orderId, code);
    if (r === 'ok') return setMsg(undefined);
    setMsg(r === 'expired' ? 'Code expired. Ask the customer for a fresh one.' : 'Wrong code. Ask them to read it again.');
  };

  const pickupPhase = order.state === 'ORDER_PLACED' || order.state === 'AGENT_ASSIGNED';

  return (
    <Screen scroll>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}>
          <T style={{ fontSize: 18, lineHeight: 20 }}>‹</T>
        </Pressable>
        <View style={s.chip}>
          <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
            {CHIP[order.state] ?? order.state}
          </T>
        </View>
      </View>

      {pickupPhase ? (
        <>
          <T kind="h1" style={s.h1}>
            Pick up the parcel
          </T>
          <T kind="caption" style={s.sub}>
            Tell us where you are, then ask the orderer for the OTP.
          </T>

          <T kind="eyebrow">Where are you?</T>
          <View style={s.seg}>
            {POINTS.map((p) => {
              const on = p === point;
              return (
                <Pressable key={p} onPress={() => setPoint(p)} style={[s.segBtn, on && s.segOn]}>
                  <T style={[s.segText, on && { color: colors.onBrand, fontFamily: fonts.bodySemi }]}>{p}</T>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <>
          <T kind="h1" style={s.h1}>
            Your job
          </T>
          <T kind="caption" style={s.sub}>
            {order.pickup} → {order.dropoff}
          </T>
        </>
      )}

      <T kind="eyebrow">Order details</T>
      <Details order={order} />

      {!!order.note && (
        <T kind="caption" style={{ fontStyle: 'italic' }}>
          “{order.note}”
        </T>
      )}
      {!!msg && (
        <T kind="caption" style={{ color: colors.error }}>
          {msg}
        </T>
      )}

      {order.state === 'ORDER_PLACED' && <Button title={`Accept · ₹${order.fare}`} onPress={onAccept} />}

      {order.state === 'AGENT_ASSIGNED' && mine && (
        <>
          <T kind="eyebrow">Collection OTP</T>
          <View style={[s.otpBox, !!order.pickupOtp && s.otpBoxOn]}>
            <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>
              {order.pickupOtp ? `OTP from ${first}` : 'No OTP for this one'}
            </T>
            {!!order.pickupOtp && <T style={s.otpCode}>{order.pickupOtp}</T>}
            <T kind="caption" style={{ fontSize: 11.5, lineHeight: 16, textAlign: 'center' }}>
              {order.pickupOtp
                ? `${first} typed this in from ${order.platform ?? 'the platform'}. Read it out to the driver.`
                : `${first} didn't enter one — the driver hands it over on the name and tracking ID.`}
            </T>
          </View>
          <Button title="I have the parcel" onPress={() => advance(orderId)} />
        </>
      )}

      {order.state === 'PICKED_UP' && mine && <Button title="On my way" onPress={() => advance(orderId)} />}
      {order.state === 'OUT_FOR_DELIVERY' && mine && <Button title="I've arrived" onPress={() => arrive(orderId)} />}
      {order.state === 'ARRIVED' && mine && (
        <View style={{ gap: space.md }}>
          <T kind="caption">Ask the customer for their six digits.</T>
          <OtpInput value={code} onChange={setCode} error={!!msg} />
          <Button title="Verify handover" onPress={onVerify} disabled={code.length < 6} />
        </View>
      )}
      {order.state === 'CONFIRMATION_RECEIVED' && mine && (
        <View style={{ gap: space.md, alignItems: 'center', paddingTop: space.sm }}>
          <T kind="eyebrow">Collect from {first}</T>
          <T style={s.amount}>₹{order.fare}</T>
          <T kind="caption" style={{ textAlign: 'center', maxWidth: 260 }}>
            Cash, or to your own UPI{me.upi ? ` (${me.upi})` : ''}. Nothing goes through the app.
          </T>
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            <SlideToComplete onComplete={() => advance(orderId)} />
            <T kind="caption" style={{ textAlign: 'center' }}>
              Completes the order once you've been paid
            </T>
          </View>
        </View>
      )}
      {order.state === 'DELIVERED' && (
        <>
          <Card style={{ gap: 4, alignItems: 'center', paddingVertical: 20 }}>
            <T kind="eyebrow">Collected</T>
            <T style={s.amount}>₹{order.fare}</T>
            <T kind="state">DELIVERED · order closed</T>
          </Card>
          <Button title="Done" onPress={() => navigation.popToTop()} />
        </>
      )}
      {mine && order.state !== 'DELIVERED' && order.state !== 'DISPUTED' && (
        <Pressable onPress={() => setReporting(true)}>
          <T kind="mono" style={s.link}>
            Can't complete this?
          </T>
        </Pressable>
      )}
      <ReportSheet
        open={reporting}
        title="Can't complete this?"
        intro="You won't be penalised for reporting honestly. The requester is told straight away and the order goes back to available for another courier."
        reasons={["Parcel isn't at the pickup point", "Wrong OTP · can't collect", 'Customer not answering']}
        submitLabel="Report and release this order"
        footnote="Your reg number and the timeline go to the campus admin"
        onSubmit={(reason, note) => {
          report(orderId, 'courier', reason, note);
          setReporting(false);
          navigation.popToTop();
        }}
        onClose={() => setReporting(false)}
      />

      {mine && !pickupPhase && (
        <Card>
          <Timeline state={order.state} />
        </Card>
      )}
    </Screen>
  );
}

function Details({ order }: { order: Order }) {
  const rows: [string, string, 'mono' | 'tag' | undefined][] = [
    ['Tracker ID', order.trackingId ?? '—', 'mono'],
    ['Platform', order.platform ?? '—', undefined],
    ['Parcel size', SIZE_LABEL[order.size], 'tag'],
    ['Ordered by', order.customerName ?? order.customerRegNo, undefined],
    ['Drop-off', order.dropoff, undefined],
    ['Driver phone', order.driverPhone ?? 'Not shared yet', order.driverPhone ? 'mono' : undefined],
    ['You earn', `₹${order.fare}`, undefined],
  ];
  return (
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      {rows.map(([k, v, kind], i) => (
        <View key={k} style={[s.row, i < rows.length - 1 && s.rowLine]}>
          <T kind="caption" style={{ fontSize: 13.5 }}>
            {k}
          </T>
          {kind === 'tag' ? (
            <View style={[s.tag, v === 'Large' && s.tagLarge]}>
              <T kind="mono" style={[{ fontSize: 10.5 }, v === 'Large' && { color: colors.brandDark }]}>
                {v}
              </T>
            </View>
          ) : (
            <T style={kind === 'mono' ? s.vMono : s.v}>{v}</T>
          )}
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.sm },
  back: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  chip: { backgroundColor: 'rgba(252,211,77,0.09)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.22)', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9 },
  h1: { fontSize: 26, lineHeight: 29, textTransform: 'none', letterSpacing: -0.5 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: -space.sm },
  seg: { flexDirection: 'row', gap: 4, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: colors.brandB },
  segText: { fontSize: 12.5, fontFamily: fonts.bodyMedium, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  rowLine: { borderBottomWidth: 1, borderColor: colors.line },
  v: { fontSize: 13.5, fontFamily: fonts.bodyMedium, textAlign: 'right' },
  vMono: { fontSize: 12.5, fontFamily: fonts.mono, textAlign: 'right' },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground },
  tagLarge: { borderColor: 'rgba(252,211,77,0.3)' },
  otpBox: { backgroundColor: colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.card, padding: 16, alignItems: 'center', gap: 4 },
  otpBoxOn: { borderStyle: 'solid', borderColor: 'rgba(252,211,77,0.3)' },
  otpCode: { fontFamily: fonts.monoMedium, fontSize: 26, letterSpacing: 5, color: colors.brandDark, marginVertical: 6 },
  amount: { fontFamily: fonts.displayBlack, fontSize: 52, lineHeight: 56, letterSpacing: -2, color: colors.brandDark },
  link: { fontSize: 11, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline', marginTop: space.sm },
});
