import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';
import { OrderCard } from '../components/OrderCard';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import type { AppStackParams } from '../navigation/types';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import { brandGradient, colors, space } from '../theme';

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

function CourierHome() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user)!;
  const setOnline = useAuth((s) => s.setOnline);
  const orders = useOrders((s) => s.orders);
  const all = Object.values(orders).sort((a, b) => b.createdAt - a.createdAt);
  const mine = all.filter((o) => o.courierRegNo === user.regNo && ACTIVE.has(o.state));
  // ponytail: own orders are listed too so one phone can play both roles; the backend will exclude them
  const open = all.filter((o) => o.state === 'ORDER_PLACED');
  const taken = all.filter((o) => o.state !== 'ORDER_PLACED' && o.courierRegNo && o.courierRegNo !== user.regNo).slice(0, 2);

  const [nudge, setNudge] = useState<string>();
  const grab = () => {
    if (!user.online) setOnline(true);
    if (open[0]) return nav.navigate('CourierJob', { orderId: open[0].id });
    setNudge("No open orders right now — you'll be first when one comes in.");
    setTimeout(() => setNudge(undefined), 2500);
  };

  return (
    <View style={{ flex: 1 }}>
    <Screen scroll>
      <Header name={user.name} />
      <Pressable onPress={() => setOnline(!user.online)}>
        <Card style={[s.online, user.online && s.onlineOn]}>
          <View style={s.row}>
            <View>
              <T kind="subtitle" style={user.online && { color: colors.onBrand }}>
                {user.online ? "You're online" : "You're offline"}
              </T>
              <T kind="caption" style={user.online && { color: colors.onBrand }}>
                {user.online ? 'Open orders near you show below' : 'Go online to see open orders'}
              </T>
            </View>
            <Switch
              value={user.online}
              onValueChange={setOnline}
              trackColor={{ false: colors.line, true: colors.onBrand }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>
      </Pressable>

      {mine.length > 0 && (
        <View style={s.section}>
          <T kind="eyebrow">Your job</T>
          {mine.map((o) => (
            <OrderCard key={o.id} order={o} onPress={() => nav.navigate('CourierJob', { orderId: o.id })} />
          ))}
        </View>
      )}

      {user.online && (
        <View style={s.section}>
          <T kind="eyebrow">Open orders</T>
          {open.length === 0 && <T kind="caption">Nothing right now. Keep walking.</T>}
          {open.map((o) => (
            <OrderCard key={o.id} order={o} onPress={() => nav.navigate('CourierJob', { orderId: o.id })} />
          ))}
          {taken.map((o) => (
            <OrderCard key={o.id} order={o} taken />
          ))}
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  online: {},
  onlineOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
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
