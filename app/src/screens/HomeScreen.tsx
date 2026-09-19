import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { OrderCard } from '../components/OrderCard';
import { WalkerGlyph } from '../components/Glyphs';
import { PICKUP_POINTS, type PickupPoint } from '../services/mock';
import type { Order } from '../store/types';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import type { AppStackParams } from '../navigation/types';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import { brandGradient, colors, fonts, space } from '../theme';

const ACTIVE = new Set(['ORDER_PLACED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED']);

export function HomeScreen() {
  const user = useAuth((s) => s.user)!;
  return user.role === 'courier' ? <CourierHome /> : <CustomerHome />;
}

function Header({ name }: { name: string }) {
  return (
    <View style={s.header}>
      <Logo variant="lockup" height={26} />
      <T kind="caption">{name}</T>
    </View>
  );
}

function CustomerHome() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user)!;
  const orders = useOrders((s) => s.orders);
  const active = Object.values(orders)
    .filter((o) => o.customerRegNo === user.regNo && ACTIVE.has(o.state))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Screen scroll>
      <Header name={user.name} />
      <T kind="h1">Something at the gate?</T>
      <T kind="caption">Someone is already walking past. Pay them a little to bring it back.</T>
      <Button title="Ask for a pickup" onPress={() => nav.navigate('NewOrder')} />
      {active.length > 0 && (
        <View style={s.section}>
          <T kind="eyebrow">In progress</T>
          {active.map((o) => (
            <OrderCard key={o.id} order={o} onPress={() => nav.navigate(routeFor(o.state), { orderId: o.id })} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const SIZE_LABEL = { S: 'Regular', M: 'Regular', L: 'Large', XL: 'Large' } as const;
const DRIVER = { name: 'Ramesh K.', phone: '+91 9XXXX 21847' }; // ponytail: platform integration later

/** Frame 3 — Delivery Agent · Assigned Orders. Pick where you are, see what's waiting there. */
function CourierHome() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user)!;
  const setOnline = useAuth((s) => s.setOnline);
  const orders = useOrders((s) => s.orders);
  const accept = useOrders((s) => s.accept);
  const [loc, setLoc] = useState<PickupPoint | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string>();

  const all = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
  // ponytail: own orders are listed too so one phone can play both roles; the backend will exclude them
  const open = all.filter((o) => o.state === 'ORDER_PLACED');
  const delivered = all.filter((o) => o.courierRegNo === user.regNo && o.state === 'DELIVERED');
  const earned = delivered.reduce((sum, o) => sum + o.fare, 0);
  const doneToday = all.filter((o) => o.state === 'DELIVERED' && Date.now() - o.updatedAt < 86_400_000);
  const avgFare = doneToday.length ? Math.round(doneToday.reduce((sum, o) => sum + o.fare, 0) / doneToday.length) : 45;
  const couriersOnline = 2 + (user.online ? 1 : 0); // ponytail: presence needs a backend; 2 stand-ins until then
  const here = loc ? all.filter((o) => o.pickup === loc && (o.state === 'ORDER_PLACED' || (o.courierRegNo === user.regNo && ACTIVE.has(o.state)))) : [];

  const pick = (p: PickupPoint) => {
    setLoc(p);
    setOpenId(null);
    if (!user.online) setOnline(true);
  };
  const start = (o: Order) => {
    if (o.state === 'ORDER_PLACED') {
      const r = accept(o.id, user.regNo);
      if (r === 'taken') return setNudge('Someone else got there first.');
    }
    nav.navigate('CourierJob', { orderId: o.id, point: loc ?? undefined });
  };
  const grab = () => {
    if (open[0]) return nav.navigate('CourierJob', { orderId: open[0].id, point: loc ?? undefined });
    setNudge("No open orders right now — you'll be first when one comes in.");
    setTimeout(() => setNudge(undefined), 2500);
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen scroll>
      <View style={s.topbar}>
        <Logo variant="mark" height={22} />
        <View style={s.chip}>
          <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>Delivery agent</T>
        </View>
      </View>
      <T kind="h1" style={s.h1}>Where are you?</T>
      <T kind="caption" style={s.sub}>Pick your location to see the orders assigned to you there.</T>

      {/* earnings ribbon */}
      <View style={s.ribbon}>
        <View style={s.ribbonIcon}>
          <WalkerGlyph size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 14, fontFamily: fonts.bodySemi }}>
            {earned > 0 ? `You've earned ₹${earned} this week` : 'Nothing earned yet this week'}
          </T>
          <T kind="caption" style={{ fontSize: 11.5 }}>
            {delivered.length} {delivered.length === 1 ? 'delivery' : 'deliveries'} · {open.length > 0 ? `${open.length} waiting right now` : 'keep walking past the gate'}
          </T>
        </View>
      </View>

      {/* live pulse */}
      <View style={s.stats}>
        <Stat n={open.length} label="orders waiting" />
        <Stat n={couriersOnline} label="couriers online" />
        <Stat n={`₹${avgFare}`} label="avg fare today" />
      </View>

      <View style={s.seg}>
        {PICKUP_POINTS.map((pt) => {
          const on = pt === loc;
          const n = open.filter((o) => o.pickup === pt).length;
          return (
            <Pressable key={pt} onPress={() => pick(pt)} style={[s.segBtn, on && s.segOn]}>
              <T style={[s.segText, on && { color: colors.onBrand, fontFamily: fonts.bodySemi }]}>
                {pt}{n > 0 ? ` · ${n}` : ''}
              </T>
            </Pressable>
          );
        })}
      </View>

      {loc && (
        <View style={s.section}>
          <T kind="eyebrow">Assigned to you here</T>
          {here.length === 0 && <T kind="caption">Nothing waiting at {loc} right now.</T>}
          {here.map((o) => {
            const isOpen = openId === o.id;
            const large = o.size === 'L' || o.size === 'XL';
            return (
              <View key={o.id} style={[s.item, isOpen && s.itemOpen]}>
                <Pressable onPress={() => setOpenId(isOpen ? null : o.id)} style={s.itemHead}>
                  <View style={{ gap: 3, flex: 1 }}>
                    <T kind="mono" style={{ fontSize: 12.5, fontFamily: fonts.monoMedium }}>{o.trackingId ?? o.id}</T>
                    <T kind="caption" style={{ fontSize: 11.5 }}>→ {o.dropoff}</T>
                  </View>
                  <View style={[s.tag, large && s.tagLarge]}>
                    <T kind="mono" style={[{ fontSize: 10.5 }, large && { color: colors.brandDark }]}>{SIZE_LABEL[o.size]}</T>
                  </View>
                  <T style={{ fontSize: 11, color: isOpen ? colors.brandDark : colors.muted, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>▾</T>
                </Pressable>
                {isOpen && (
                  <View style={s.itemBody}>
                    <Row k="Platform" v={o.platform ?? '—'} />
                    <Row k="Ordered by" v={o.customerName ?? o.customerRegNo} />
                    <Row k="Drop-off" v={o.dropoff} />
                    <Row k="Delivery driver" v={o.pickup === 'Amazon Pick Up Point' ? 'Amazon Logistics' : DRIVER.name} />
                    <Row k="Driver phone" v={o.pickup === 'Amazon Pick Up Point' ? '—' : DRIVER.phone} mono />
                    <Row k="You earn" v={`₹${o.fare}`} />
                    <Button title={o.state === 'ORDER_PLACED' ? 'Accept & start pickup →' : 'Continue pickup →'} onPress={() => start(o)} style={{ marginTop: 8 }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>

    {/* floating accept: jumps to the newest open order */}
    {!!nudge && (
      <View style={s.nudge}>
        <T kind="caption" style={{ color: colors.ink }}>{nudge}</T>
      </View>
    )}
    <Pressable onPress={grab} style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityLabel="Accept an order">
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fabFill}>
        <View style={s.plusH} />
        <View style={s.plusV} />
      </LinearGradient>
      {open.length > 0 && (
        <View style={s.badge}>
          <T kind="mono" style={{ fontSize: 10, color: colors.ink }}>{open.length}</T>
        </View>
      )}
    </Pressable>
    </View>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <View style={s.stat}>
      <T style={s.statN}>{n}</T>
      <T kind="caption" style={{ fontSize: 11 }}>{label}</T>
    </View>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <T kind="caption" style={{ fontSize: 13 }}>{k}</T>
      <T style={mono ? { fontSize: 12.5, fontFamily: fonts.mono } : { fontSize: 13, fontFamily: fonts.bodyMedium }}>{v}</T>
    </View>
  );
}

export function routeFor(state: string): 'Searching' | 'Track' | 'Handover' | 'Delivered' {
  switch (state) {
    case 'ORDER_PLACED':
      return 'Searching';
    case 'ARRIVED':
      return 'Handover';
    case 'DELIVERED':
      return 'Delivered';
    default:
      return 'Track';
  }
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  section: { gap: space.sm, marginTop: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.sm },
  chip: { backgroundColor: 'rgba(252,211,77,0.09)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.22)', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 9 },
  h1: { fontSize: 26, lineHeight: 29, textTransform: 'none', letterSpacing: -0.5 },
  sub: { fontSize: 13.5, lineHeight: 20, marginTop: -space.sm },
  seg: { flexDirection: 'row', gap: 4, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: colors.brandB },
  segText: { fontSize: 12.5, fontFamily: fonts.bodyMedium, color: colors.muted },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  statN: { fontFamily: fonts.displayBlack, fontSize: 20, color: colors.brandDark },
  ribbon: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(252,211,77,0.07)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.22)', borderRadius: 14, padding: 12 },
  ribbonIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandB, alignItems: 'center', justifyContent: 'center' },
  item: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden' },
  itemOpen: { borderColor: 'rgba(252,211,77,0.3)' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  itemBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderColor: colors.line },
  tag: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground },
  tagLarge: { borderColor: 'rgba(252,211,77,0.3)' },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: colors.brandB,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabFill: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  plusH: { position: 'absolute', width: 22, height: 3.5, borderRadius: 2, backgroundColor: colors.onBrand },
  plusV: { position: 'absolute', width: 3.5, height: 22, borderRadius: 2, backgroundColor: colors.onBrand },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.ground,
    borderWidth: 1.5,
    borderColor: colors.brandB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudge: {
    position: 'absolute',
    left: 16,
    right: 90,
    bottom: 30,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
});
