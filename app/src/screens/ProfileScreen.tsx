import type React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ParcelGlyph, WalkerGlyph } from '../components/Glyphs';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import { brandGradient, colors, fonts, radius, space } from '../theme';

export function ProfileScreen() {
  const user = useAuth((s) => s.user)!;
  const setRole = useAuth((s) => s.setRole);
  const signOut = useAuth((s) => s.signOut);
  const setUpi = useAuth((s) => s.setUpi);
  const orders = useOrders((s) => s.orders);
  const resetOrders = useOrders((s) => s.reset);

  const all = Object.values(orders);
  const delivered = all.filter((o) => o.courierRegNo === user.regNo && o.state === 'DELIVERED');
  const placed = all.filter((o) => o.customerRegNo === user.regNo);
  const earned = delivered.reduce((sum, o) => sum + o.fare, 0);
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen scroll>
      <View style={s.hero}>
        <View style={s.avatar}>
          <T style={s.initials}>{initials}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T kind="title">{user.name}</T>
          <T kind="mono" style={{ color: colors.muted }}>
            {user.regNo}
            {user.block ? ` · ${user.block}` : ''}
          </T>
          <View style={s.verified}>
            <View style={s.tick} />
            <T kind="mono" style={{ fontSize: 11.5, color: colors.brandDark }}>
              Verified student
            </T>
          </View>
        </View>
      </View>

      <View style={s.stats}>
        <Stat n={delivered.length} label="delivered" />
        <Stat n={`₹${earned}`} label="earned" />
        <Stat n={placed.length} label="orders placed" />
      </View>

      <View style={s.section}>
        <T kind="eyebrow">Role</T>
        <View style={s.roles}>
          <RoleCard
            on={user.role === 'courier'}
            title="Deliver & earn"
            body="Carry parcels on your way"
            icon={<WalkerGlyph size={22} />}
            onPress={() => setRole('courier')}
          />
          <RoleCard
            on={user.role === 'customer'}
            title="Get delivered"
            body="Skip the walk to the gate"
            icon={<ParcelGlyph size={22} />}
            onPress={() => setRole('customer')}
          />
        </View>
        <T kind="caption">One account, both sides. Switch whenever you like.</T>
      </View>

      <View style={s.section}>
        <T kind="eyebrow">Contact</T>
        <Card style={{ gap: 0 }}>
          <Row k="Phone" v={user.phone ?? '—'} />
          <Row k="Email" v={user.email ?? '—'} />
          <Row k="Hostel block" v={user.block ?? '—'} />
          <View style={[s.row, { paddingVertical: 6 }]}>
            <T kind="caption" style={{ fontSize: 13 }}>
              UPI ID
            </T>
            <TextInput
              value={user.upi ?? ''}
              onChangeText={setUpi}
              placeholder="yourname@upi"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={s.upiInput}
            />
          </View>
        </Card>
        <T kind="caption">Only shown to a courier while they carry your parcel. Your UPI ID is shown to customers so they can pay you directly.</T>
      </View>

      <View style={s.bottom}>
        <Button
          title="Sign out"
          variant="danger"
          onPress={() => {
            resetOrders(); // orders are device-local only; a shared phone must start clean for the next student
            signOut();
          }}
        />
      </View>
    </Screen>
  );
}

/** Mini Frame 2: the two halves as side-by-side cards, black glyph on a gradient tile. */
function RoleCard({ on, title, body, icon, onPress }: { on: boolean; title: string; body: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.role, on && s.roleOn, pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.tile, !on && s.tileOff]}>
        {icon}
      </LinearGradient>
      <T style={[s.roleTitle, !on && { color: colors.muted }]}>{title}</T>
      <T kind="caption" style={{ fontSize: 11 }}>
        {body}
      </T>
      {on && (
        <T kind="mono" style={s.roleTag}>
          ACTIVE
        </T>
      )}
    </Pressable>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <Card style={s.stat}>
      <T style={s.statN}>{n}</T>
      <T kind="caption" style={{ fontSize: 11 }}>
        {label}
      </T>
    </Card>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowLine]}>
      <T kind="caption" style={{ fontSize: 13 }}>
        {k}
      </T>
      <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>{v}</T>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.displayBlack, fontSize: 24, color: colors.onBrand },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tick: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandDark },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, paddingHorizontal: 8 },
  statN: { fontFamily: fonts.displayBlack, fontSize: 22, color: colors.brandDark },
  section: { gap: space.sm },
  roles: { flexDirection: 'row', gap: space.sm },
  role: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 14, gap: 4 },
  roleOn: { borderColor: colors.brandB, backgroundColor: 'rgba(252,211,77,0.07)' },
  tile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileOff: { opacity: 0.45 },
  roleTitle: { fontFamily: fonts.displayBlack, fontSize: 15, letterSpacing: -0.2 },
  roleTag: { fontSize: 11, color: colors.brandDark, letterSpacing: 1.2, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  rowLine: { borderBottomWidth: 1, borderColor: colors.line },
  upiInput: { minWidth: 160, textAlign: 'right', color: colors.ink, fontFamily: fonts.mono, fontSize: 13.5, paddingVertical: 6 },
  bottom: { gap: space.sm, paddingTop: space.md },
});
