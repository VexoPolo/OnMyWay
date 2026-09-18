import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { T } from '../components/Text';
import { useAuth } from '../store/auth';
import { useOrders } from '../store/orders';
import type { Role } from '../store/types';
import { colors, radius, space } from '../theme';

export function ProfileScreen() {
  const user = useAuth((s) => s.user)!;
  const setRole = useAuth((s) => s.setRole);
  const signOut = useAuth((s) => s.signOut);
  const resetOrders = useOrders((s) => s.reset);

  return (
    <Screen scroll>
      <T kind="h1" style={s.title}>
        Profile
      </T>
      <Card>
        <T kind="eyebrow">Registration number</T>
        <T kind="title">{user.regNo}</T>
        <T kind="caption">{user.name}</T>
      </Card>

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

      <View style={s.bottom}>
        <Button title="Clear demo orders" variant="ghost" onPress={resetOrders} />
        <Button title="Sign out" variant="danger" onPress={signOut} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { paddingTop: space.sm },
  section: { gap: space.sm },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 4,
  },
  seg: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2 },
  segOn: { backgroundColor: colors.brandB },
  bottom: { marginTop: 'auto', gap: space.sm, paddingTop: space.lg },
});
