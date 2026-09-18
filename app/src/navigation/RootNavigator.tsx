import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { MyOrdersScreen } from '../screens/MyOrdersScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { RoleScreen } from '../screens/auth/RoleScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { CourierJobScreen } from '../screens/courier/CourierJobScreen';
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

function Icon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[s.icon, focused && s.iconOn]}>
      <Text style={[s.iconText, focused && s.iconTextOn]}>{label}</Text>
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ focused }) => <Icon label="H" focused={focused} /> }} />
      <Tab.Screen
        name="MyOrders"
        component={MyOrdersScreen}
        options={{ title: 'My Orders', tabBarIcon: ({ focused }) => <Icon label="O" focused={focused} /> }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <Icon label="P" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const user = useAuth((s) => s.user);
  return (
    <NavigationContainer theme={theme}>
      {!user ? (
        <Auth.Navigator screenOptions={noHeader}>
          <Auth.Screen name="Register" component={RegisterScreen} />
          <Auth.Screen name="SignIn" component={SignInScreen} />
          <Auth.Screen name="Otp" component={OtpScreen} />
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
        </App.Navigator>
      )}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  icon: { width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: colors.brandB, borderColor: colors.brandB },
  iconText: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.muted },
  iconTextOn: { color: colors.onBrand },
});
