import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useOrders } from '../../store/orders';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Handover'>;

/** Customer side: read the four digits aloud. The courier types them. Neither swaps a number. */
export function HandoverScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const refresh = useOrders((s) => s.arrive); // re-arriving issues a fresh 5-minute code
  const [left, setLeft] = useState('');
  const expired = left === '0:00';

  useEffect(() => {
    if (!order?.otp) return;
    const tick = () => {
      const ms = Math.max(0, order.otp!.expiresAt - Date.now());
      const m = Math.floor(ms / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}:${sec.toString().padStart(2, '0')}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [order?.otp]);

  useEffect(() => {
    if (order?.state === 'CONFIRMATION_RECEIVED' || order?.state === 'DELIVERED') navigation.replace('Delivered', { orderId });
  }, [order?.state, navigation, orderId]);

  if (!order?.otp) return null;

  return (
    <Screen>
      <View style={s.top}>
        <T kind="eyebrow">{order.courierName ? `${order.courierName} is at your door` : 'Your courier is at your door'}</T>
        <T kind="h1">Four digits</T>
        <T kind="caption">Read this to {order.courierName?.split(' ')[0] ?? 'the courier'}. It proves the parcel reached the right person.</T>
      </View>
      <View style={s.code} accessible accessibilityLabel={`Your code is ${order.otp.code.split('').join(' ')}`}>
        {order.otp.code.split('').map((d, i) => (
          <View key={i} style={s.box}>
            <T style={s.digit}>{d}</T>
          </View>
        ))}
      </View>
      <Card>
        <View style={s.row}>
          <T kind="caption">Expires in</T>
          <T kind="mono" style={{ color: left === '0:00' ? colors.error : colors.brandDark }}>
            {left}
          </T>
        </View>
        <View style={s.row}>
          <T kind="caption">Once the courier confirms</T>
          <T kind="state">CONFIRMATION_RECEIVED</T>
        </View>
      </Card>
      {expired && (
        <>
          <T kind="caption" style={{ color: colors.error, textAlign: 'center' }}>
            This code has expired.
          </T>
          <Button title="Get a fresh code" onPress={() => refresh(orderId)} />
        </>
      )}
      <Button title="Back to home" variant="ghost" onPress={() => navigation.popToTop()} style={{ marginTop: 'auto' }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { gap: space.sm, paddingTop: space.lg },
  code: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: space.xl },
  box: {
    width: 66,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: fonts.monoMedium, fontSize: 38, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
