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
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export type PackageSize = 'S' | 'M' | 'L' | 'XL';

export interface Profile {
  regNo: string;
  name: string;
  email: string;
  phone: string;
  block: string; // e.g. MH-F
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
  size: PackageSize;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fare: number;
  note?: string;
  state: OrderState;
  createdAt: number;
  updatedAt: number;
  /** 6-digit handover code + expiry; generated when courier arrives */
  otp?: { code: string; expiresAt: number };
}
