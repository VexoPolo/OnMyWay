import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AppStackParams } from '../../navigation/types';
import { PICKUP_POINTS, estimateKm, type PickupPoint } from '../../services/mock';
import { useAuth } from '../../store/auth';
import { platformOf, quoteFare, useOrders } from '../../store/orders';
import type { PackageSize } from '../../store/types';
import { colors, fonts, space } from '../../theme';

type Props = NativeStackScreenProps<AppStackParams, 'NewOrder'>;

const SIZES: { id: PackageSize; label: string }[] = [
  { id: 'M', label: 'Regular' },
  { id: 'L', label: 'Large' },
];

/** Frame 5 — Place your order. Drop-off is the student's own block from their profile. */
export function NewOrderScreen({ navigation }: Props) {
  const user = useAuth((s) => s.user)!;
  const place = useOrders((s) => s.place);
  const [size, setSize] = useState<PackageSize>('M');
  const [pickup, setPickup] = useState<PickupPoint>('Main Gate');
  const [trackingId, setTrackingId] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [pickupOtp, setPickupOtp] = useState('');

  const dropoff = user.block ? `${user.block} block` : 'Your block';
  const km = estimateKm(pickup, user.block ?? '');
  const fare = quoteFare(size, km);
  const tid = trackingId.trim().toUpperCase();
  const ready = tid.length >= 6 && (!needsOtp || pickupOtp.length >= 4);

  const submit = () => {
    const order = place({
      customerRegNo: user.regNo,
      customerName: user.name,
      size,
      pickup,
      dropoff,
      distanceKm: km,
      trackingId: tid,
      customerPhone: user.phone,
      platform: platformOf(tid),
      pickupOtp: needsOtp ? pickupOtp : undefined,
    });
    navigation.replace('Searching', { orderId: order.id });
  };

  return (
    <Screen scroll>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}>
          <T style={{ fontSize: 18, lineHeight: 20 }}>‹</T>
        </Pressable>
        <View style={s.chip}>
          <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
            New order
          </T>
        </View>
      </View>
      <T kind="h1" style={s.h1}>
        Place your order
      </T>
      <T kind="caption" style={s.sub}>
        Tell us about the parcel so a courier can find and carry it.
      </T>

      <T kind="eyebrow">Parcel size</T>
      <Seg options={SIZES.map((x) => x.label)} value={SIZES.find((x) => x.id === size)!.label} onChange={(l) => setSize(SIZES.find((x) => x.label === l)!.id)} />

      <T kind="eyebrow" style={{ marginTop: space.xs }}>
        Pickup point
      </T>
      <Seg options={[...PICKUP_POINTS]} value={pickup} onChange={(v) => setPickup(v as PickupPoint)} />
      <T kind="caption" style={{ fontSize: 11, marginTop: -space.xs }}>
        Where the parcel will be waiting for a courier · drop-off at {dropoff}
      </T>

      <View>
        <Field label="Tracking ID" placeholder="e.g. TBA3049182765" autoCapitalize="characters" autoCorrect={false} value={trackingId} onChangeText={setTrackingId} />
        <T kind="caption" style={{ fontSize: 11, marginTop: 6 }}>
          From the courier app or order confirmation SMS
        </T>
      </View>

      <Card style={s.toggleRow}>
        <View style={{ flex: 1, gap: 3 }}>
          <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>Needs an OTP to collect?</T>
          <T kind="caption" style={{ fontSize: 11.5, lineHeight: 16 }}>
            Turn this on if the platform gives a pickup code
          </T>
        </View>
        <Switch value={needsOtp} onValueChange={setNeedsOtp} trackColor={{ false: colors.line, true: colors.brandB }} thumbColor="#FFFFFF" />
      </Card>
      {needsOtp && (
        <View>
          <Field
            label="Enter OTP"
            placeholder="· · · · · ·"
            keyboardType="number-pad"
            maxLength={6}
            value={pickupOtp}
            onChangeText={(t) => setPickupOtp(t.replace(/\D/g, ''))}
            style={{ textAlign: 'center', fontFamily: fonts.mono, letterSpacing: 6, fontSize: 17 }}
          />
          <T kind="caption" style={{ fontSize: 11, marginTop: 6 }}>
            You'll get this from the delivery platform — pass it on to your courier
          </T>
        </View>
      )}

      <View style={s.bottom}>
        <Button title={`Confirm order · ₹${fare}`} onPress={submit} disabled={!ready} />
        <T kind="caption" style={{ textAlign: 'center' }}>
          A courier heading your way will pick this up
        </T>
      </View>
    </Screen>
  );
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[s.segBtn, on && s.segOn]}>
            <T style={[s.segText, on && { color: colors.onBrand, fontFamily: fonts.bodySemi }]}>{o}</T>
          </Pressable>
        );
      })}
    </View>
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  bottom: { gap: space.sm, marginTop: space.md },
});
