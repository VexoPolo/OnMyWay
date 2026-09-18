import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { colors, space } from '../theme';

const ACTIVE = new Set(['ORDER_PLACED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'CONFIRMATION_RECEIVED', 'PAID']);

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
  const open = all.filter((o) => o.state === 'ORDER_PLACED' && o.customerRegNo !== user.regNo);
  const taken = all.filter((o) => o.state !== 'ORDER_PLACED' && o.courierRegNo && o.courierRegNo !== user.regNo).slice(0, 2);

  return (
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
  );
}

export function routeFor(state: string): 'Searching' | 'Track' | 'Handover' | 'Pay' | 'Delivered' {
  switch (state) {
    case 'ORDER_PLACED':
      return 'Searching';
    case 'ARRIVED':
      return 'Handover';
    case 'CONFIRMATION_RECEIVED':
      return 'Pay';
    case 'PAID':
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
});
