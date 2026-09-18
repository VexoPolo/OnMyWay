import { StyleSheet, View } from 'react-native';
import type { OrderState } from '../store/types';
import { colors, space } from '../theme';
import { T } from './Text';

const STEPS: { state: OrderState; label: string }[] = [
  { state: 'ORDER_PLACED', label: 'Order placed' },
  { state: 'AGENT_ASSIGNED', label: 'Courier assigned' },
  { state: 'PICKED_UP', label: 'Picked up' },
  { state: 'OUT_FOR_DELIVERY', label: 'On the way' },
  { state: 'ARRIVED', label: 'Arrived' },
  { state: 'CONFIRMATION_RECEIVED', label: 'Handover confirmed' },
  { state: 'PAID', label: 'Paid' },
  { state: 'DELIVERED', label: 'Delivered' },
];

export function Timeline({ state }: { state: OrderState }) {
  const idx = STEPS.findIndex((x) => x.state === state);
  return (
    <View style={s.list}>
      {STEPS.map((step, i) => {
        const done = i < idx;
        const live = i === idx;
        return (
          <View key={step.state} style={s.row}>
            <View style={s.rail}>
              <View style={[s.dot, done && s.dotDone, live && s.dotLive]} />
              {i < STEPS.length - 1 && <View style={[s.line, done && s.lineDone]} />}
            </View>
            <View style={s.body}>
              <T style={[s.label, (done || live) && { color: colors.ink }]}>{step.label}</T>
              {live && <T kind="state">{step.state}</T>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: {},
  row: { flexDirection: 'row', gap: space.md, minHeight: 44 },
  rail: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.ground },
  dotDone: { borderColor: colors.brandB, backgroundColor: colors.brandB },
  dotLive: { borderColor: colors.brandA, backgroundColor: colors.ground },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 2 },
  lineDone: { backgroundColor: colors.brandB },
  body: { flex: 1, paddingBottom: space.sm, gap: 2 },
  label: { color: colors.muted },
});
