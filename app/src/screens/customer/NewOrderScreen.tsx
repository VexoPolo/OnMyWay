import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Route } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { CAMPUS_PLACES, estimateKm } from '../../services/mock';
import { useAuth } from '../../store/auth';
import { quoteFare, useOrders } from '../../store/orders';
import type { PackageSize } from '../../store/types';
import { colors, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'NewOrder'>;

const SIZES: { id: PackageSize; label: string; hint: string }[] = [
  { id: 'S', label: 'S', hint: 'Envelope' },
  { id: 'M', label: 'M', hint: 'Shoebox' },
  { id: 'L', label: 'L', hint: 'Backpack' },
  { id: 'XL', label: 'XL', hint: 'Two hands' },
];

export function NewOrderScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user)!;
  const place = useOrders((s) => s.place);
  const [size, setSize] = useState<PackageSize>('M');
  const [pickup, setPickup] = useState<string>('Main Gate');
  const [dropoff, setDropoff] = useState<string>('Block C');
  const [note, setNote] = useState('');

  const km = useMemo(() => estimateKm(pickup, dropoff), [pickup, dropoff]);
  const fare = quoteFare(size, km);

  const submit = () => {
    const order = place({ customerRegNo: user.regNo, size, pickup, dropoff, distanceKm: km, note: note || undefined });
    navigation.replace('Searching', { orderId: order.id });
  };

  return (
    <Screen scroll>
      <T kind="eyebrow">New order</T>
      <T kind="h1">Describe the drop</T>

      <View style={s.section}>
        <T kind="eyebrow">Package size</T>
        <View style={s.sizes}>
          {SIZES.map((o) => {
            const on = o.id === size;
            return (
              <Pressable key={o.id} onPress={() => setSize(o.id)} style={[s.size, on && s.sizeOn]}>
                <T kind="title" style={on && { color: colors.onBrand }}>
                  {o.label}
                </T>
                <T kind="caption" style={on && { color: colors.onBrand }}>
                  {o.hint}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.section}>
        <T kind="eyebrow">Pickup</T>
        <PlacePicker value={pickup} onChange={setPickup} />
        <T kind="eyebrow">Drop-off</T>
        <PlacePicker value={dropoff} onChange={setDropoff} />
      </View>

      <Field label="Note for the courier (optional)" placeholder="Parcel is under the name Meera" value={note} onChangeText={setNote} />

      <Card>
        <Route pickup={pickup} dropoff={dropoff} />
        <View style={s.fareRow}>
          <View>
            <T kind="eyebrow">Estimated fare</T>
            <T kind="caption">{km} km · goes to the courier</T>
          </View>
          <T kind="h1" style={{ color: colors.brandDark }}>
            ₹{fare}
          </T>
        </View>
      </Card>

      <Button title="Place order" onPress={submit} disabled={pickup === dropoff} />
    </Screen>
  );
}

function PlacePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {CAMPUS_PLACES.map((p) => {
        const on = p === value;
        return (
          <Pressable key={p} onPress={() => onChange(p)} style={[s.chip, on && s.chipOn]}>
            <T style={[{ fontSize: 14 }, on && { color: colors.onBrand }]}>{p}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { gap: space.sm },
  sizes: { flexDirection: 'row', gap: space.sm },
  size: {
    flex: 1,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xs },
});
