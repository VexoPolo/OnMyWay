import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { OrderCard } from '../components/OrderCard';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import type { AppStackParams } from '../navigation/types';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import { space } from '../theme';
import { routeFor } from './HomeScreen';

export function MyOrdersScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParams>>();
  const user = useAuth((s) => s.user)!;
  const orders = useOrders((s) => s.orders);
  const list = Object.values(orders)
    .filter((o) => o.customerRegNo === user.regNo || o.courierRegNo === user.regNo)
    .sort((a, b) => b.createdAt - a.createdAt);
  const doneStates = new Set(['DELIVERED', 'CANCELLED']);
  const active = list.filter((o) => !doneStates.has(o.state));
  const done = list.filter((o) => doneStates.has(o.state));

  return (
    <Screen scroll>
      <T kind="h1" style={s.title}>
        My orders
      </T>
      {list.length === 0 && <T kind="caption">No orders yet.</T>}
      {active.length > 0 && <T kind="eyebrow">Active</T>}
      <View style={s.list}>
        {active.map((o) => {
          const asCourier = o.courierRegNo === user.regNo;
          return (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() =>
                asCourier ? nav.navigate('CourierJob', { orderId: o.id }) : nav.navigate(routeFor(o.state), { orderId: o.id })
              }
            />
          );
        })}
      </View>
      {done.length > 0 && <T kind="eyebrow" style={{ marginTop: 8 }}>Done</T>}
      <View style={[s.list, { opacity: 0.7 }]}>
        {done.map((o) => {
          const asCourier = o.courierRegNo === user.regNo;
          return (
            <OrderCard
              key={o.id}
              order={o}
              onPress={() =>
                asCourier ? nav.navigate('CourierJob', { orderId: o.id }) : nav.navigate(routeFor(o.state), { orderId: o.id })
              }
            />
          );
        })}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { paddingTop: space.sm },
  list: { gap: space.sm },
});
