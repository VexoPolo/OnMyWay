import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { OrderCard } from '../components/OrderCard';
import { PinGlyph } from '../components/Glyphs';
import { PICKUP_POINTS, type PickupPoint } from '../services/mock';
import type { Order } from '../store/types';
import { Screen } from '../components/Screen';
import { Tap } from '../components/Tap';
import { T } from '../components/Text';
import type { AppStackParams } from '../navigation/types';
import { useAuth } from '../store/auth';
import { MAX_BATCH, useOrders } from '../store/orders';
import { brandGradient, colors, fonts, radius, space } from '../theme';

const ACTIVE = new Set(['ORDER_PLACED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'CONFIRMATION_RECEIVED', 'DISPUTED']);

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

/** Frame 3 — Delivery Agent · Assigned Orders. Pick where you are, see what's waiting there. */
function CourierHome() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user)!;
  const setOnline = useAuth((s) => s.setOnline);
  const orders = useOrders((s) => s.orders);
  const accept = useOrders((s) => s.accept);
  const acceptMany = useOrders((s) => s.acceptMany);
  const [loc, setLoc] = useState<PickupPoint | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string>();
  const [picked, setPicked] = useState<string[]>([]); // batch selection, max MAX_BATCH
  const [taking, setTaking] = useState(false);

  const all = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
  // ponytail: own orders are listed too so one phone can play both roles; the backend will exclude them
  const open = all.filter((o) => o.state === 'ORDER_PLACED');
  const delivered = all.filter((o) => o.courierRegNo === user.regNo && o.state === 'DELIVERED' && Date.now() - o.updatedAt < 7 * 86_400_000);
  const earned = delivered.reduce((sum, o) => sum + o.fare, 0);
  const here = loc ? all.filter((o) => o.pickup === loc && (o.state === 'ORDER_PLACED' || (o.courierRegNo === user.regNo && ACTIVE.has(o.state)))) : [];
  // Already carrying something? The run screen is the way back into it.
  const carrying = all.filter((o) => o.courierRegNo === user.regNo && ACTIVE.has(o.state) && o.state !== 'ORDER_PLACED');
  const chosen = picked.filter((id) => orders[id]?.state === 'ORDER_PLACED');
  const chosenFare = chosen.reduce((sum, id) => sum + (orders[id]?.fare ?? 0), 0);
  const roomLeft = MAX_BATCH - carrying.length;

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= roomLeft) {
        setNudge(roomLeft <= 0 ? `Finish your run first — ${MAX_BATCH} parcels is the limit.` : `${MAX_BATCH} parcels per run. Drop one to add another.`);
        setTimeout(() => setNudge(undefined), 2500);
        return prev;
      }
      return [...prev, id];
    });
  };

  const takeBatch = async () => {
    setTaking(true);
    const { won, lost } = await acceptMany(chosen, user.regNo, user.upi);
    setTaking(false);
    setPicked([]);
    if (won.length === 0) {
      setNudge('Someone else got there first.');
      return setTimeout(() => setNudge(undefined), 2500);
    }
    if (lost > 0) {
      setNudge(`${lost} ${lost === 1 ? 'parcel was' : 'parcels were'} taken by someone else.`);
      setTimeout(() => setNudge(undefined), 3000);
    }
    nav.navigate('Run');
  };

  const pick = (p: PickupPoint) => {
    setLoc(p);
    setOpenId(null);
    if (!user.online) setOnline(true);
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const start = async (o: Order) => {
    if (o.state === 'ORDER_PLACED') {
      setBusyId(o.id);
      const r = await accept(o.id, user.regNo, user.upi);
      setBusyId(null);
      if (r !== 'ok') return setNudge(r === 'taken' ? 'Someone else got there first.' : "Can't reach the server — try again.");
    }
    nav.navigate('CourierJob', { orderId: o.id, point: loc ?? undefined });
  };
  // The + takes the newest open order where the courier is standing; anywhere, if they haven't said.
  const grab = () => {
    const next = open.find((o) => !loc || o.pickup === loc);
    if (next) return nav.navigate('CourierJob', { orderId: next.id, point: loc ?? undefined });
    setNudge(loc ? `Nothing waiting at ${loc} right now.` : "No open orders right now — you'll be first when one comes in.");
    setTimeout(() => setNudge(undefined), 2500);
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen scroll>
      <View style={s.topbar}>
        <Logo variant="mark" height={22} />
        <View style={s.chip}>
          <T kind="mono" style={{ fontSize: 11.5, color: colors.brandDark }}>Delivery agent</T>
        </View>
      </View>
      <T kind="h1" style={s.h1}>Where are you?</T>
      <T kind="caption" style={s.sub}>Tap where you're standing. We'll show what's waiting there.</T>

      {/* the only decision on this screen: which gate */}
      <View style={s.places} accessibilityRole="radiogroup">
        {PICKUP_POINTS.map((pt) => {
          const on = pt === loc;
          const n = open.filter((o) => o.pickup === pt).length;
          return (
            <Tap key={pt} onPress={() => pick(pt)} style={[s.place, on && s.placeOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <PinGlyph size={22} color={on ? colors.onBrand : colors.brandDark} />
              <T style={[s.placeText, on && { color: colors.onBrand }]}>{pt}</T>
              <T kind="mono" style={[s.placeCount, on && { color: colors.onBrand }]}>
                {n === 0 ? 'nothing waiting' : n === 1 ? '1 parcel waiting' : `${n} parcels waiting`}
              </T>
            </Tap>
          );
        })}
      </View>

      <T kind="caption" style={{ fontSize: 12.5 }}>
        {earned > 0
          ? `₹${earned} earned this week · ${delivered.length} ${delivered.length === 1 ? 'delivery' : 'deliveries'}`
          : 'Nothing earned yet this week — every parcel is ₹20–30 in hand.'}
      </T>

      {carrying.length > 0 && (
        <Tap onPress={() => nav.navigate('Run')} style={s.runCard} accessibilityLabel="Open your run">
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontSize: 14, fontFamily: fonts.bodySemi }}>
              Carrying {carrying.length} {carrying.length === 1 ? 'parcel' : 'parcels'}
            </T>
            <T kind="caption" style={{ fontSize: 11.5 }}>{carrying.map((o) => o.dropoff).join(' · ')}</T>
          </View>
          <T kind="mono" style={{ fontSize: 11, color: colors.brandDark }}>OPEN RUN ›</T>
        </Tap>
      )}

      {loc && (
        <View style={s.section}>
          <T kind="eyebrow">{chosen.length > 0 ? 'Tick the ones you can carry' : 'Assigned to you here'}</T>
          {here.length === 0 && <T kind="caption">Nothing waiting at {loc} right now.</T>}
          {here.map((o) => {
            const isOpen = openId === o.id;
            const large = o.size === 'L' || o.size === 'XL';
            return (
              <View key={o.id} style={[s.item, isOpen && s.itemOpen]}>
                <Tap onPress={() => setOpenId(isOpen ? null : o.id)} style={s.itemHead} accessibilityLabel={`${o.trackingId ?? 'Parcel'} to ${o.dropoff}`} accessibilityState={{ expanded: isOpen }}>
                  {o.state === 'ORDER_PLACED' && (
                    <Tap
                      onPress={() => toggle(o.id)}
                      style={[s.check, picked.includes(o.id) && s.checkOn]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: picked.includes(o.id) }}
                      accessibilityLabel={`Add ${o.dropoff} to this run`}
                    >
                      {picked.includes(o.id) && <T style={{ fontSize: 12, color: colors.onBrand }}>✓</T>}
                    </Tap>
                  )}
                  <View style={{ gap: 3, flex: 1 }}>
                    <T kind="mono" style={{ fontSize: 12.5, fontFamily: fonts.monoMedium }}>{o.trackingId ?? `Parcel for ${o.customerName?.split(' ')[0] ?? o.customerRegNo}`}</T>
                    <T kind="caption" style={{ fontSize: 11.5 }}>→ {o.dropoff}</T>
                  </View>
                  <View style={[s.tag, large && s.tagLarge]}>
                    <T kind="mono" style={[{ fontSize: 10.5 }, large && { color: colors.brandDark }]}>{SIZE_LABEL[o.size]}</T>
                  </View>
                  <T style={{ fontSize: 11, color: isOpen ? colors.brandDark : colors.muted, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}>▾</T>
                </Tap>
                {isOpen && (
                  <View style={s.itemBody}>
                    <Row k="Platform" v={o.platform ?? '—'} />
                    <Row k="Ordered by" v={o.customerName ?? o.customerRegNo} />
                    <Row k="Drop-off" v={o.dropoff} />
                    <Row k="Driver phone" v={o.driverPhone ?? 'Not shared yet'} mono={!!o.driverPhone} />
                    <Row k="You earn" v={`₹${o.fare}`} />
                    <Button title={o.state === 'ORDER_PLACED' ? 'Accept & start pickup →' : 'Continue pickup →'} onPress={() => start(o)} loading={busyId === o.id} style={{ marginTop: 8 }} />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Screen>

    {/* batch bar: only while parcels are selected */}
    {chosen.length > 0 && (
      <View style={s.batchBar}>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontSize: 14, fontFamily: fonts.bodySemi }}>
            {chosen.length} {chosen.length === 1 ? 'parcel' : 'parcels'} · ₹{chosenFare}
          </T>
          <T kind="caption" style={{ fontSize: 11.5 }}>
            {roomLeft - chosen.length > 0 ? `room for ${roomLeft - chosen.length} more` : 'full run'}
          </T>
        </View>
        <Button title="Take them →" onPress={takeBatch} loading={taking} style={{ flex: 1 }} />
      </View>
    )}

    {/* floating accept: jumps to the newest open order */}
    {!!nudge && (
      <View style={s.nudge}>
        <T kind="caption" style={{ color: colors.ink }}>{nudge}</T>
      </View>
    )}
    <Pressable
      onPress={() => (carrying.length > 0 ? nav.navigate('Run') : grab())}
      style={({ pressed }) => [s.fab, pressed && { transform: [{ scale: 0.94 }] }]}
      accessibilityLabel={carrying.length > 0 ? 'Open your run' : 'Accept an order'}
    >
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fabFill}>
        <View style={s.plusH} />
        <View style={s.plusV} />
      </LinearGradient>
      {(carrying.length > 0 || open.length > 0) && (
        <View style={s.badge}>
          <T kind="mono" style={{ fontSize: 10, color: colors.ink }}>{carrying.length > 0 ? carrying.length : open.length}</T>
        </View>
      )}
    </Pressable>
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
    case 'CONFIRMATION_RECEIVED':
    case 'DELIVERED':
    case 'DISPUTED':
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
  places: { flexDirection: 'row', gap: 10 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  batchBar: { position: 'absolute', left: 16, right: 16, bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14 },
  runCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(252,211,77,0.07)', borderWidth: 1, borderColor: 'rgba(252,211,77,0.28)', borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14, marginTop: space.xs },
  place: { flex: 1, minHeight: 112, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, gap: 6, justifyContent: 'flex-end' },
  placeOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  placeText: { fontSize: 15, fontFamily: fonts.bodySemi, color: colors.ink },
  placeCount: { fontSize: 11, color: colors.muted },
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
