import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParams = {
  Register: undefined;
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
};
