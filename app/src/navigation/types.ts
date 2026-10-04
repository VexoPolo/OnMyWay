import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParams = {
  Welcome: undefined;
  /** email: prefilled when a signed-in student still has to register */
  Register: { email?: string } | undefined;
  SignIn: undefined;
  Otp: undefined;
  Role: undefined;
};

export type TabParams = {
  Home: undefined;
  MyOrders: undefined;
  Profile: undefined;
};

export type AppStackParams = {
  Tabs: NavigatorScreenParams<TabParams>;
  NewOrder: undefined;
  Searching: { orderId: string };
  Track: { orderId: string };
  Handover: { orderId: string };
  Delivered: { orderId: string };
  CourierJob: { orderId: string; point?: string };
  Run: undefined;
};
