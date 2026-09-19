import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Order, OrderState, PackageSize } from './types';

// Frames price by parcel class only: Regular (S/M) ₹40, Large (L/XL) ₹55.
const SIZE_BASE: Record<PackageSize, number> = { S: 40, M: 40, L: 55, XL: 55 };
const PER_KM = 0;

/** Fare is quoted before the order is placed and goes to the courier. */
export function quoteFare(size: PackageSize, distanceKm: number): number {
  return Math.round((SIZE_BASE[size] + PER_KM * distanceKm) / 5) * 5;
}

const NEXT: Partial<Record<OrderState, OrderState>> = {
  ORDER_PLACED: 'AGENT_ASSIGNED',
  AGENT_ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'ARRIVED',
  ARRIVED: 'CONFIRMATION_RECEIVED', // handover verified — courier still has to collect the fare
  CONFIRMATION_RECEIVED: 'DELIVERED', // slide-to-complete
};

interface OrdersState {
  orders: Record<string, Order>;
  place: (draft: Omit<Order, 'id' | 'state' | 'createdAt' | 'updatedAt' | 'fare'>) => Order;
  /** First-come-first-served: one atomic conditional write on an unassigned order. */
  accept: (orderId: string, courierRegNo: string, courierUpi?: string) => 'ok' | 'taken' | 'missing';
  advance: (orderId: string) => void;
  arrive: (orderId: string) => string; // generates OTP, returns code (customer side reads it)
  confirmHandover: (orderId: string, code: string) => 'ok' | 'wrong' | 'expired';
  cancel: (orderId: string) => void;
  rate: (orderId: string, rating: number) => void;
  /** Customer report flags the order DISPUTED. Courier report releases it back to the pool. */
  report: (orderId: string, by: 'customer' | 'courier', reason: string, note?: string) => void;
  reset: () => void;
}

const now = () => Date.now();
const uid = () => 'OMW-' + Math.random().toString(36).slice(2, 7).toUpperCase();

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: {},
      place: (draft) => {
        const order: Order = {
          ...draft,
          id: uid(),
          fare: quoteFare(draft.size, draft.distanceKm),
          state: 'ORDER_PLACED',
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ orders: { ...s.orders, [order.id]: order } }));
        return order;
      },
      accept: (orderId, courierRegNo, courierUpi) => {
        // The conditional write: only succeeds if still unassigned.
        const o = get().orders[orderId];
        if (!o) return 'missing';
        if (o.state !== 'ORDER_PLACED' || o.courierRegNo) return 'taken';
        set((s) => ({
          orders: { ...s.orders, [orderId]: { ...o, courierRegNo, courierUpi, state: 'AGENT_ASSIGNED', updatedAt: now() } },
        }));
        return 'ok';
      },
      advance: (orderId) =>
        set((s) => {
          const o = s.orders[orderId];
          const next = o && NEXT[o.state];
          if (!o || !next) return {};
          return { orders: { ...s.orders, [orderId]: { ...o, state: next, updatedAt: now() } } };
        }),
      arrive: (orderId) => {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        set((s) => {
          const o = s.orders[orderId];
          if (!o) return {};
          return {
            orders: {
              ...s.orders,
              [orderId]: { ...o, state: 'ARRIVED', otp: { code, expiresAt: now() + 5 * 60_000 }, updatedAt: now() },
            },
          };
        });
        return code;
      },
      confirmHandover: (orderId, code) => {
        const o = get().orders[orderId];
        if (!o?.otp) return 'wrong';
        if (now() > o.otp.expiresAt) return 'expired';
        if (o.otp.code !== code) return 'wrong';
        set((s) => ({
          orders: { ...s.orders, [orderId]: { ...o, state: 'CONFIRMATION_RECEIVED', updatedAt: now() } },
        }));
        return 'ok';
      },
      cancel: (orderId) =>
        set((s) => {
          const o = s.orders[orderId];
          if (!o) return {};
          return { orders: { ...s.orders, [orderId]: { ...o, state: 'CANCELLED', updatedAt: now() } } };
        }),
      rate: (orderId, rating) =>
        set((s) => {
          const o = s.orders[orderId];
          if (!o) return {};
          return { orders: { ...s.orders, [orderId]: { ...o, rating, updatedAt: now() } } };
        }),
      report: (orderId, by, reason, note) =>
        set((s) => {
          const o = s.orders[orderId];
          if (!o) return {};
          const report = { by, reason, note: note || undefined, at: now() };
          const next: Order =
            by === 'courier'
              ? { ...o, report, courierRegNo: undefined, courierUpi: undefined, otp: undefined, state: 'ORDER_PLACED', updatedAt: now() }
              : { ...o, report, state: 'DISPUTED', updatedAt: now() };
          return { orders: { ...s.orders, [orderId]: next } };
        }),
      reset: () => set({ orders: {} }),
    }),
    { name: 'onmyway.orders', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
