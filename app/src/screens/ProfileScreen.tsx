import type React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import { brandGradient, colors, fonts, radius, space } from '../theme';

export function ProfileScreen() {
  const user = useAuth((s) => s.user)!;
  const setRole = useAuth((s) => s.setRole);
  const signOut = useAuth((s) => s.signOut);
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
            <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
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
            icon={<WalkerGlyph />}
            onPress={() => setRole('courier')}
          />
          <RoleCard
            on={user.role === 'customer'}
            title="Get delivered"
            body="Skip the walk to the gate"
            icon={<ParcelGlyph />}
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
          <Row k="Hostel block" v={user.block ?? '—'} last />
        </Card>
        <T kind="caption">Only shown to a courier while they carry your parcel.</T>
      </View>

      <View style={s.bottom}>
        <Button title="Clear demo orders" variant="ghost" onPress={resetOrders} />
        <Button title="Sign out" variant="danger" onPress={signOut} />
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

/** Small black walking figure with a parcel. */
function WalkerGlyph() {
  return (
    <View style={{ width: 20, height: 24, alignItems: 'center' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.onBrand }} />
      <View style={{ width: 2.2, height: 8, backgroundColor: colors.onBrand, borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: 8, right: 1, width: 6, height: 5, borderRadius: 1, backgroundColor: colors.onBrand }} />
      <View style={{ position: 'absolute', top: 13, width: 2.2, height: 10, borderRadius: 1, backgroundColor: colors.onBrand, transform: [{ rotate: '-24deg' }, { translateY: 3 }] }} />
      <View style={{ position: 'absolute', top: 13, width: 2.2, height: 10, borderRadius: 1, backgroundColor: colors.onBrand, transform: [{ rotate: '24deg' }, { translateY: 3 }] }} />
    </View>
  );
}

/** Small black parcel: box outline with a tape line. */
function ParcelGlyph() {
  return (
    <View style={{ width: 20, height: 18, borderWidth: 2.2, borderColor: colors.onBrand, borderRadius: 3, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 2.2, backgroundColor: colors.onBrand }} />
      <View style={{ position: 'absolute', top: 3, left: 6, width: 2.2, bottom: 0, backgroundColor: colors.onBrand }} />
    </View>
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
  roleTag: { fontSize: 9.5, color: colors.brandDark, letterSpacing: 1.2, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  rowLine: { borderBottomWidth: 1, borderColor: colors.line },
  bottom: { gap: space.sm, paddingTop: space.md },
});
