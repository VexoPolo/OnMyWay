import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { useMockCourier } from '../../services/mockCourier';
import { useOrders } from '../../store/orders';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Handover'>;

/** Customer side: read the six digits aloud. The courier types them. Neither swaps a number. */
export function HandoverScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  useMockCourier(orderId);
  const [left, setLeft] = useState('');

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
    if (order?.state === 'DELIVERED') navigation.replace('Delivered', { orderId });
  }, [order?.state, navigation, orderId]);

  if (!order?.otp) return null;

  return (
    <Screen>
      <View style={s.top}>
        <T kind="eyebrow">Courier is here</T>
        <T kind="h1">Six digits</T>
        <T kind="caption">Read this to the courier. It proves the parcel reached the right person.</T>
      </View>
      <View style={s.code}>
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
          <T kind="state">DELIVERED</T>
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { gap: space.sm, paddingTop: space.lg },
  code: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: space.xl },
  box: {
    width: 50,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontFamily: fonts.monoMedium, fontSize: 30, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
