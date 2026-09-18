import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { OtpInput } from '../../components/OtpInput';
import { Route } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import { Timeline } from '../../components/Timeline';
import type { AppStackParams } from '../../navigation/types';
import { useAuth } from '../../store/auth';
import { useOrders } from '../../store/orders';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'CourierJob'>;

export function CourierJobScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const me = useAuth((s) => s.user)!;
  const order = useOrders((s) => s.orders[orderId]);
  const accept = useOrders((s) => s.accept);
  const advance = useOrders((s) => s.advance);
  const arrive = useOrders((s) => s.arrive);
  const confirm = useOrders((s) => s.confirmHandover);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string>();

  if (!order) return null;
  const mine = order.courierRegNo === me.regNo;

  const onAccept = () => {
    const r = accept(orderId, me.regNo);
    if (r === 'taken') setMsg('Someone else got there first. This job is taken.');
  };

  const onVerify = () => {
    const r = confirm(orderId, code);
    if (r === 'ok') return setMsg(undefined);
    setMsg(r === 'expired' ? 'Code expired. Ask the customer for a fresh one.' : 'Wrong code. Ask them to read it again.');
  };

  const action = (() => {
    if (order.state === 'ORDER_PLACED') return <Button title={`Accept · ₹${order.fare}`} onPress={onAccept} />;
    if (!mine) return null;
    switch (order.state) {
      case 'AGENT_ASSIGNED':
        return <Button title="I have the parcel" onPress={() => advance(orderId)} />;
      case 'PICKED_UP':
        return <Button title="On my way" onPress={() => advance(orderId)} />;
      case 'OUT_FOR_DELIVERY':
        return <Button title="I've arrived" onPress={() => arrive(orderId)} />;
      case 'ARRIVED':
        return (
          <View style={s.otp}>
            <T kind="caption">Ask the customer for their six digits.</T>
            <OtpInput value={code} onChange={setCode} error={!!msg} />
            <Button title="Verify handover" onPress={onVerify} disabled={code.length < 6} />
          </View>
        );
      case 'CONFIRMATION_RECEIVED':
        return <T kind="caption">Waiting for the customer to pay…</T>;
      case 'PAID':
      case 'DELIVERED':
        return <Button title="Done" onPress={() => navigation.popToTop()} />;
      default:
        return null;
    }
  })();

  return (
    <Screen scroll>
      <View style={s.top}>
        <T kind="eyebrow">{order.id}</T>
        <T kind="h1">{order.state === 'ORDER_PLACED' ? 'Open order' : 'Your job'}</T>
        <T kind="state">{order.state}</T>
      </View>
      <Card>
        <Route pickup={order.pickup} dropoff={order.dropoff} />
        <View style={s.row}>
          <T kind="caption">
            Size {order.size} · {order.distanceKm} km
          </T>
          <T kind="subtitle" style={{ color: colors.brandDark }}>
            ₹{order.fare}
          </T>
        </View>
        {!!order.note && <T kind="caption">“{order.note}”</T>}
      </Card>
      {!!msg && (
        <T kind="caption" style={{ color: colors.error }}>
          {msg}
        </T>
      )}
      {action}
      {mine && (
        <Card>
          <Timeline state={order.state} />
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { gap: space.xs, paddingTop: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  otp: { gap: space.md },
});
