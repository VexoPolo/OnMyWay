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
  regNo: string;
  name: string;
  role: Role | null; // null until picked on first run
  online: boolean; // courier availability
}

export interface Order {
  id: string;
  customerRegNo: string;
  courierRegNo?: string;
  courierName?: string;
  courierPhone?: string; // shown to the customer while the order is live
  size: PackageSize;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fare: number;
  note?: string;
  customerName?: string;
  customerPhone?: string;
  trackingId?: string;
  platform?: string; // e.g. Amazon, Flipkart
  pickupOtp?: string; // platform's collection code, shared with the courier on request
  driverPhone?: string; // the platform driver's number, from the customer's Amazon/Flipkart app
  state: OrderState;
  createdAt: number;
  updatedAt: number;
  /** 6-digit handover code + expiry; generated when courier arrives */
  otp?: { code: string; expiresAt: number };
  courierUpi?: string;
  rating?: number; // 1-5, set by the customer once delivered
  report?: { by: 'customer' | 'courier'; reason: string; note?: string; at: number };
}
