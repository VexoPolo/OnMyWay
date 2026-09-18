import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OtpInput } from '../../components/OtpInput';
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
const DRIVER = { name: 'Ramesh K.', phone: '+91 9XXXX 21847' };

const CHIP: Record<string, string> = {
  ORDER_PLACED: 'Open order',
  AGENT_ASSIGNED: 'Order accepted',
  PICKED_UP: 'Parcel collected',
  OUT_FOR_DELIVERY: 'On the way',
  ARRIVED: 'At the door',
  DELIVERED: 'Delivered',
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

  const [point, setPoint] = useState<(typeof POINTS)[number]>(fromHub === 'Amazon Pick Up Point' ? 'Amazon Pick Up Point' : 'Main Gate');
  const [otpStage, setOtpStage] = useState<'idle' | 'requested' | 'received'>('idle');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string>();

  // The orderer "shares" the platform OTP a beat after it's requested.
  useEffect(() => {
    if (otpStage !== 'requested') return;
    const t = setTimeout(() => setOtpStage('received'), 2000);
    return () => clearTimeout(t);
  }, [otpStage]);

  if (!order) return null;
  const mine = order.courierRegNo === me.regNo;
  const first = (order.customerName ?? 'the orderer').split(' ')[0];
  const pickupCode = order.pickupOtp ?? String(orderId.replace(/\D/g, '') || '58194').padEnd(5, '4').slice(0, 5);

  const onAccept = () => {
    const r = accept(orderId, me.regNo);
    if (r === 'taken') setMsg('Someone else got there first. This job is taken.');
  };
  const onVerify = () => {
    const r = confirm(orderId, code);
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
          <T kind="eyebrow">OTP</T>
          <View style={[s.otpBox, otpStage === 'received' && s.otpBoxOn]}>
            <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>
              {otpStage === 'idle' ? 'Not requested yet' : otpStage === 'requested' ? 'Request sent' : `OTP from ${first}`}
            </T>
            {otpStage === 'received' && <T style={s.otpCode}>{pickupCode}</T>}
            <T kind="caption" style={{ fontSize: 11.5, lineHeight: 16, textAlign: 'center' }}>
              {otpStage === 'idle'
                ? 'The person who placed the order gets a push notification and shares the OTP with you here.'
                : otpStage === 'requested'
                  ? `Waiting for ${first} to share the OTP…`
                  : 'Read this out to the driver.'}
            </T>
          </View>
          {otpStage === 'received' ? (
            <Button title="I have the parcel" onPress={() => advance(orderId)} />
          ) : (
            <Button
              title={otpStage === 'idle' ? `Request OTP from ${first}` : `Requested · waiting for ${first}`}
              variant={otpStage === 'idle' ? 'primary' : 'ghost'}
              onPress={() => setOtpStage('requested')}
              disabled={otpStage === 'requested'}
            />
          )}
          <T kind="caption" style={{ textAlign: 'center' }}>
            Show the OTP to the driver to collect the parcel
          </T>
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
      {order.state === 'DELIVERED' && <Button title="Done" onPress={() => navigation.popToTop()} />}

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
    ['Delivery driver', order.pickup === 'Amazon Pick Up Point' ? 'Amazon Logistics' : DRIVER.name, undefined],
    ['Driver phone', order.pickup === 'Amazon Pick Up Point' ? '—' : DRIVER.phone, 'mono'],
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
});
