import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { PinGlyph, WalkerGlyph } from '../components/Glyphs';
import { HomeScreen } from '../screens/HomeScreen';
import { MyOrdersScreen } from '../screens/MyOrdersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { RoleScreen } from '../screens/auth/RoleScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { CourierJobScreen } from '../screens/courier/CourierJobScreen';
import { RunScreen } from '../screens/courier/RunScreen';
import { DeliveredScreen } from '../screens/customer/DeliveredScreen';
import { HandoverScreen } from '../screens/customer/HandoverScreen';
import { NewOrderScreen } from '../screens/customer/NewOrderScreen';
import { SearchingScreen } from '../screens/customer/SearchingScreen';
import { TrackScreen } from '../screens/customer/TrackScreen';
import { useAuth } from '../store/auth';
import { colors, fonts } from '../theme';
import type { AppStackParams, AuthStackParams, TabParams } from './types';

const Auth = createNativeStackNavigator<AuthStackParams>();
const App = createNativeStackNavigator<AppStackParams>();
const Tab = createBottomTabNavigator<TabParams>();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ground, card: colors.ground, border: colors.line, primary: colors.brandDark, text: colors.ink },
};

const noHeader = { headerShown: false } as const;

/** Tab icon with the tint-and-dot active state. Home = the logo's pin, Orders = cube, Profile = the walker. */
function Icon({ kind, focused }: { kind: 'home' | 'orders' | 'profile'; focused: boolean }) {
  const c = focused ? colors.brandDark : colors.muted;
  return (
    <View style={s.icon}>
      {kind === 'home' && <PinGlyph size={24} color={c} />}
      {kind === 'orders' && <Ionicons name="cube" size={23} color={c} />}
      {kind === 'profile' && <WalkerGlyph size={24} color={c} />}
      {focused && <View style={s.dot} />}
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ground, borderTopColor: colors.line, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <Icon kind="home" focused={focused} /> }} />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{ title: 'My Orders', tabBarIcon: ({ focused }) => <Icon kind="orders" focused={focused} /> }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <Icon kind="profile" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const user = useAuth((s) => s.user);
  return (
    <NavigationContainer theme={theme}>
      {!user ? (
        <Auth.Navigator screenOptions={noHeader}>
          <Auth.Screen name="Welcome" component={WelcomeScreen} />
          <Auth.Screen name="Register" component={RegisterScreen} />
          <Auth.Screen name="SignIn" component={SignInScreen} />
        </Auth.Navigator>
      ) : !user.role ? (
        <Auth.Navigator screenOptions={noHeader}>
          <Auth.Screen name="Role" component={RoleScreen} />
        </Auth.Navigator>
      ) : (
        <App.Navigator screenOptions={noHeader}>
          <App.Screen name="Tabs" component={Tabs} />
          <App.Screen name="NewOrder" component={NewOrderScreen} />
          <App.Screen name="Searching" component={SearchingScreen} options={{ gestureEnabled: false }} />
          <App.Screen name="Track" component={TrackScreen} />
          <App.Screen name="Handover" component={HandoverScreen} options={{ gestureEnabled: false }} />
          <App.Screen name="Delivered" component={DeliveredScreen} />
          <App.Screen name="CourierJob" component={CourierJobScreen} />
          <App.Screen name="Run" component={RunScreen} />
        </App.Navigator>
      )}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  icon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: -6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brandDark },
});
