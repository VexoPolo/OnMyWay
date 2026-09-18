import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { api } from '../../services/mock';
import { useOrders } from '../../store/orders';
import { colors, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'Pay'>;

export function PayScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const order = useOrders((s) => s.orders[orderId]);
  const markPaid = useOrders((s) => s.markPaid);
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!order) return;
    setBusy(true);
    await api.pay(order.id, order.fare); // resolves when the "webhook" confirms
    markPaid(order.id);
    navigation.replace('Delivered', { orderId });
  };

  if (!order) return null;

  return (
    <Screen scroll>
      <View style={s.top}>
        <T kind="eyebrow">Handover confirmed</T>
        <T kind="h1">Pay</T>
        <T kind="caption">Scan with any UPI app. The order moves to PAID only when the gateway confirms.</T>
      </View>
      <View style={s.amountRow}>
        <T kind="h1" style={{ color: colors.brandDark, fontSize: 48, lineHeight: 52 }}>
          ₹{order.fare}
        </T>
        <T kind="caption">to courier {order.courierRegNo}</T>
      </View>
      <Card style={s.qrCard}>
        <Qr seed={order.id} />
        <T kind="mono" style={{ color: colors.muted }}>
          {order.id} · UPI
        </T>
      </Card>
      <Button title={busy ? 'Waiting for webhook…' : 'I have paid'} onPress={pay} loading={busy} />
      <T kind="caption" style={{ textAlign: 'center' }}>
        Demo: the button simulates the gateway callback.
      </T>
    </Screen>
  );
}

/** Deterministic fake QR — the one pure-white surface in the dark UI. */
function Qr({ seed }: { seed: string }) {
  const N = 21;
  const cells = useMemo(() => {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const out: boolean[] = [];
    for (let i = 0; i < N * N; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      out.push(((h >>> 16) & 1) === 1);
    }
    // finder squares
    const finder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          out[(oy + y) * N + ox + x] = edge || core;
        }
    };
    finder(0, 0);
    finder(N - 7, 0);
    finder(0, N - 7);
    return out;
  }, [seed]);
  return (
    <View style={s.qr}>
      {Array.from({ length: N }).map((_, y) => (
        <View key={y} style={s.qrRow}>
          {Array.from({ length: N }).map((__, x) => (
            <View key={x} style={[s.cell, cells[y * N + x] && s.cellOn]} />
          ))}
        </View>
      ))}
    </View>
  );
}

const CELL = 9;
const s = StyleSheet.create({
  top: { gap: space.sm, paddingTop: space.lg },
  amountRow: { alignItems: 'center', gap: 2, marginVertical: space.sm },
  qrCard: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  qr: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: radius.md },
  qrRow: { flexDirection: 'row' },
  cell: { width: CELL, height: CELL },
  cellOn: { backgroundColor: '#000000' },
});
