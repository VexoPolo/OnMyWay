import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import type { Role } from '../store/types';
import { colors, fonts, radius, space } from '../theme';

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
        <View style={s.toggle}>
          {(['customer', 'courier'] as Role[]).map((r) => {
            const on = user.role === r;
            return (
              <Pressable key={r} onPress={() => setRole(r)} style={[s.seg, on && s.segOn]}>
                <T kind="subtitle" style={[{ fontSize: 15 }, on && { color: colors.onBrand }]}>
                  {r === 'customer' ? 'Customer' : 'Courier'}
                </T>
              </Pressable>
            );
          })}
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
  toggle: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 4 },
  seg: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2 },
  segOn: { backgroundColor: colors.brandB },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  rowLine: { borderBottomWidth: 1, borderColor: colors.line },
  bottom: { gap: space.sm, paddingTop: space.md },
});
