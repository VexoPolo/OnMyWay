export type Role = 'customer' | 'courier';

export const ORDER_STATES = [
  'ORDER_PLACED',
  'AGENT_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'ARRIVED',
  'CONFIRMATION_RECEIVED',
  'PAID',
  'DELIVERED',
  'CANCELLED',
  'DISPUTED',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export type PackageSize = 'S' | 'M' | 'L' | 'XL';

export interface Profile {
  regNo: string;
  name: string;
  email: string;
  phone: string;
  block: string; // e.g. MH-F
  upi?: string; // personal UPI id — couriers get paid to it, outside the app
}

export interface User extends Partial<Omit<Profile, 'regNo' | 'name'>> {
  id: string; // auth.uid() — the only identity the backend trusts
  regNo: string;
  name: string;
  role: Role | null; // null until picked on first run
  online: boolean; // courier availability
}

export interface Order {
  id: string;
  /** auth.uid() of the student who placed it — use for "is this mine?" */
  customerId: string;
  /** auth.uid() of the courier carrying it */
  courierId?: string;
  size: PackageSize;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fare: number; // set by the server (quote_fare / place_order), never computed here
  note?: string;
  trackingId?: string;
  platform?: string; // e.g. Amazon, Flipkart — derived by the server from the tracking ID
  state: OrderState;
  createdAt: number;
  updatedAt: number;
  /** When the current handover PIN stops working (public: both sides count down). */
  pinExpiresAt?: number;
  rating?: number; // 1-5, set by the customer once delivered

  // ---- display only. Filled from get_order_private, so only the customer and the courier on
  // ---- this order ever have them. Never use them to decide who someone is.
  customerName?: string;
  customerPhone?: string;
  customerRegNo?: string;
  courierName?: string;
  courierPhone?: string; // shown to the customer while the order is live
  courierRegNo?: string;
  courierUpi?: string;
  pickupOtp?: string; // platform's collection code, shared with the courier on request
  driverPhone?: string; // the platform driver's number, from the customer's Amazon/Flipkart app
  /** 4-digit handover code + expiry. Customer only; the courier never receives it. */
  otp?: { code: string; expiresAt: number };
  pinAttemptsLeft?: number;
  /** Your own report on this order, if you filed one. */
  report?: { by: 'customer' | 'courier'; reason: string; note?: string; at: number };
}
