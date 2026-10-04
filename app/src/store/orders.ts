import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as api from '../services/backend/api';
import { toApiError } from '../services/backend/errors';
import { estimateKm, type PickupPoint } from '../services/mock';
import { useAuth } from './auth';
import type { Order, OrderState, PackageSize } from './types';

/** One courier carries at most this many parcels per run (the server enforces it too). */
export const MAX_BATCH = 4;

/** Orders that are still moving — the ones whose private details we keep fresh. */
const LIVE = new Set<OrderState>(['ORDER_PLACED', 'AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'CONFIRMATION_RECEIVED']);
/** States where get_order_private answers the courier. */
const COURIER_SEES = new Set<OrderState>(['AGENT_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'CONFIRMATION_RECEIVED']);

// ---------------------------------------------------------------------------
// server record -> app Order. Everything except the display-only fields comes from the row;
// those (names, phones, codes) are kept from the previous copy and refreshed by loadPrivate().
// ---------------------------------------------------------------------------

type Display = Pick<
  Order,
  | 'customerName'
  | 'customerPhone'
  | 'customerRegNo'
  | 'courierName'
  | 'courierPhone'
  | 'courierRegNo'
  | 'courierUpi'
  | 'pickupOtp'
  | 'driverPhone'
  | 'otp'
  | 'pinAttemptsLeft'
  | 'report'
>;

function displayOf(prev: Order | undefined, courierId: string | undefined): Display {
  if (!prev) return {};
  const sameCourier = prev.courierId === courierId;
  return {
    customerName: prev.customerName,
    customerPhone: prev.customerPhone,
    customerRegNo: prev.customerRegNo,
    pickupOtp: prev.pickupOtp,
    driverPhone: prev.driverPhone,
    report: prev.report,
    // a different (or no) courier now: don't show the old one's details or PIN
    ...(sameCourier
      ? { courierName: prev.courierName, courierPhone: prev.courierPhone, courierRegNo: prev.courierRegNo, courierUpi: prev.courierUpi, otp: prev.otp, pinAttemptsLeft: prev.pinAttemptsLeft }
      : {}),
  };
}

function toAppOrder(r: api.OrderRecord, prev?: Order): Order {
  const block = r.dropoff;
  return {
    ...displayOf(prev, r.courierId),
    id: r.id,
    customerId: r.customerId,
    courierId: r.courierId,
    size: r.size,
    pickup: r.pickup,
    dropoff: block ? (/block/i.test(block) ? block : `${block} block`) : 'Your block',
    distanceKm: estimateKm(r.pickup, block),
    fare: r.fare,
    note: r.note,
    trackingId: r.trackingId,
    platform: r.platform,
    state: r.state,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    pinExpiresAt: r.pinExpiresAt,
    rating: r.rating,
  };
}

const now = () => Date.now();
const me = () => useAuth.getState().user;

// A full fetch is thrown away if a write started before it (seq) or is still in flight when it
// returns (inflight) — otherwise it could undo an optimistic change the server hasn't made yet.
let seq = 0;
let inflight = 0;
/** order id -> the updatedAt we last fetched private details for */
const privateAt: Record<string, number> = {};
const privatePending = new Set<string>();

function put(o: Order) {
  useOrders.setState((s) => ({ orders: { ...s.orders, [o.id]: o } }));
}

function applyRecords(records: api.OrderRecord[], replace: boolean) {
  useOrders.setState((s) => {
    const orders: Record<string, Order> = replace ? {} : { ...s.orders };
    for (const r of records) orders[r.id] = toAppOrder(r, s.orders[r.id]);
    return { orders };
  });
  void loadPrivate();
}

/**
 * Names, phones, pickup code, PIN — only for orders I'm on, and only when the order changed
 * since we last asked. Customers also get their own report on disputed orders.
 */
async function loadPrivate() {
  const u = me();
  if (!u) return;
  const due = Object.values(useOrders.getState().orders).filter((o) => {
    if (privatePending.has(o.id) || privateAt[o.id] === o.updatedAt) return false;
    if (o.customerId === u.id) return LIVE.has(o.state) || !o.courierName || (o.state === 'DISPUTED' && !o.report);
    return o.courierId === u.id && COURIER_SEES.has(o.state);
  });
  await Promise.all(
    due.map(async (o) => {
      privatePending.add(o.id);
      try {
        const [p, report] = await Promise.all([
          api.getOrderPrivate(o.id),
          o.customerId === u.id && o.state === 'DISPUTED' ? api.getMyReport(o.id) : Promise.resolve(undefined),
        ]);
        privateAt[o.id] = o.updatedAt;
        const cur = useOrders.getState().orders[o.id];
        if (!cur) return;
        const next: Order = { ...cur, report: report ?? cur.report };
        if (p) {
          next.pickupOtp = p.pickupOtp;
          next.driverPhone = p.driverPhone;
          next.pinAttemptsLeft = p.pinAttemptsLeft;
          if (p.myRole === 'customer') {
            next.customerName = u.name;
            next.customerPhone = u.phone;
            next.customerRegNo = u.regNo;
            next.otp = p.pin;
            next.courierName = p.other?.name;
            next.courierRegNo = p.other?.regNo;
            next.courierPhone = p.other?.phone;
            next.courierUpi = p.other?.upi;
          } else {
            next.courierName = u.name;
            next.courierPhone = u.phone;
            next.courierRegNo = u.regNo;
            next.courierUpi = u.upi;
            next.customerName = p.other?.name;
            next.customerRegNo = p.other?.regNo;
            next.customerPhone = p.other?.phone;
            next.otp = undefined; // the courier never holds the PIN
          }
        }
        put(next);
      } catch (e) {
        console.warn('get_order_private', toApiError(e).code);
      } finally {
        privatePending.delete(o.id);
      }
    }),
  );
}

/** Pull the last week of everything RLS lets me see. Replaces the cache wholesale. */
export async function sync() {
  if (!me()) return;
  const at = seq;
  try {
    const records = await api.listOrders(7);
    if (at !== seq || inflight > 0) return;
    applyRecords(records, true);
  } catch (e) {
    console.warn('sync', toApiError(e).code);
  }
}

/**
 * Run a server action. `local` is applied immediately (optimistic); whatever happens, we
 * re-sync afterwards so the screen ends up showing what the server actually did.
 */
async function write<T>(orderId: string | null, local: Partial<Order> | null, run: () => Promise<T>): Promise<T> {
  seq++;
  inflight++;
  if (orderId && local) {
    const o = useOrders.getState().orders[orderId];
    if (o) put({ ...o, ...local, updatedAt: now() });
  }
  try {
    return await run();
  } finally {
    inflight--;
    if (orderId) delete privateAt[orderId];
    void sync();
  }
}

/** Same, for taps that don't wait on the answer: failures are logged and the re-sync fixes the UI. */
function fire(orderId: string, local: Partial<Order> | null, run: () => Promise<unknown>) {
  write(orderId, local, run).catch((e) => console.warn('order action', toApiError(e).code));
}

/** Live feed: initial pull, realtime rows, and a poll as a safety net. Returns a stop fn. */
export function startSync() {
  void sync();
  const stop = api.subscribeOrders((r) => {
    if (inflight > 0) return; // a write is mid-flight; its own re-sync will bring this in
    applyRecords([r], false);
  });
  // realtime can't tell us when an order LEAVES our view (e.g. someone else took it), so poll
  const timer = setInterval(() => AppState.currentState === 'active' && void sync(), 4000);
  const sub = AppState.addEventListener('change', (st) => st === 'active' && void sync());
  return () => {
    stop();
    clearInterval(timer);
    sub.remove();
  };
}

// ---------------------------------------------------------------------------

export type AcceptOutcome = api.AcceptResult | 'offline';

/** What to tell a courier when an accept doesn't go through. */
export const ACCEPT_COPY: Record<Exclude<AcceptOutcome, 'ok'>, string> = {
  taken: 'Someone else got there first.',
  limit: `You're carrying ${MAX_BATCH} parcels, the most for one run. Deliver one first.`,
  own: "That's your own order. Another courier has to take it.",
  missing: 'This order was cancelled.',
  offline: "Can't reach the server — try again.",
};
export type HandoverOutcome = api.VerifyResult | 'offline';

/** What the courier sees when the customer's code doesn't go through. */
export const HANDOVER_COPY: Record<Exclude<HandoverOutcome, 'ok'>, string> = {
  wrong: 'Wrong code. Ask them to read it again.',
  expired: 'Code expired. Ask the customer for a fresh one.',
  locked: '5 wrong tries, so the code is locked. Ask the customer to tap “Get a fresh code”.',
  offline: "Can't reach the server — try again.",
};

export interface NewOrderInput {
  size: PackageSize;
  pickup: PickupPoint;
  trackingId?: string;
  note?: string;
  pickupOtp?: string;
  driverPhone?: string;
}

interface OrdersState {
  orders: Record<string, Order>;
  /** Server price per size, from quote_fare. Missing until loaded. */
  fares: Partial<Record<PackageSize, number>>;
  loadFares: () => Promise<void>;
  /** The server sets id, fare, platform and drop-off block. Throws ApiError. */
  place: (input: NewOrderInput) => Promise<Order>;
  /** First-come-first-served on the server: two phones can't both win. */
  accept: (orderId: string) => Promise<AcceptOutcome>;
  /** Take several open orders in one go (max MAX_BATCH). Returns the ids actually won. */
  acceptMany: (orderIds: string[]) => Promise<{ won: string[]; lost: number; limit: boolean }>;
  /** Courier's next step: picked up -> on my way, or slide-to-complete after the handover. */
  advance: (orderId: string) => void;
  /** Courier is at the door. The server makes the PIN; only the customer can read it. */
  arrive: (orderId: string) => void;
  /** Customer: a fresh 5-minute PIN (also clears a lock-out). */
  refreshPin: (orderId: string) => void;
  confirmHandover: (orderId: string, code: string) => Promise<HandoverOutcome>;
  /** Customer: only until pickup. Resolves true once the server has cancelled it. */
  cancel: (orderId: string) => Promise<boolean>;
  rate: (orderId: string, rating: number) => void;
  /** Customer adds the platform driver's number once the platform shares it. */
  setDriverPhone: (orderId: string, phone: string) => void;
  /** Customer report -> DISPUTED. Courier report -> back to the pool. The server decides which. */
  report: (orderId: string, reason: string, note?: string) => void;
  reset: () => void;
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: {},
      fares: {},

      loadFares: async () => {
        const sizes: PackageSize[] = ['S', 'M', 'L', 'XL'];
        try {
          const quotes = await Promise.all(sizes.map((sz) => api.quoteFare(sz)));
          set({ fares: Object.fromEntries(sizes.map((sz, i) => [sz, quotes[i]])) });
        } catch (e) {
          console.warn('quote_fare', toApiError(e).code);
        }
      },

      place: async (input) => {
        const rec = await write(null, null, () =>
          api.placeOrder({
            pickup: input.pickup,
            trackingId: input.trackingId,
            size: input.size,
            note: input.note,
            pickupOtp: input.pickupOtp,
            driverPhone: input.driverPhone,
          }),
        );
        const u = me();
        // we typed these in, so show them right away instead of waiting for get_order_private
        const order: Order = {
          ...toAppOrder(rec),
          customerName: u?.name,
          customerPhone: u?.phone,
          customerRegNo: u?.regNo,
          pickupOtp: input.pickupOtp,
          driverPhone: input.driverPhone,
        };
        put(order);
        return order;
      },

      accept: async (orderId) => {
        const o = get().orders[orderId];
        if (!o) return 'missing';
        if (o.state !== 'ORDER_PLACED') return 'taken';
        try {
          const r = await write(orderId, null, () => api.acceptOrder(orderId));
          if (r === 'ok') {
            const cur = get().orders[orderId] ?? o;
            put({ ...cur, courierId: me()?.id, state: 'AGENT_ASSIGNED', updatedAt: now() });
          }
          return r;
        } catch {
          return 'offline';
        }
      },

      acceptMany: async (orderIds) => {
        // Sequential on purpose: each accept is its own first-tap-wins call, so a race
        // costs one order, not the run.
        const won: string[] = [];
        let lost = 0;
        let limit = false;
        for (const id of orderIds.slice(0, MAX_BATCH)) {
          const r = await get().accept(id);
          if (r === 'ok') won.push(id);
          else if (r === 'limit') {
            limit = true;
            break;
          } else lost++;
        }
        return { won, lost, limit };
      },

      advance: (orderId) => {
        const o = get().orders[orderId];
        if (!o) return;
        if (o.state === 'AGENT_ASSIGNED') fire(orderId, { state: 'PICKED_UP' }, () => api.advanceOrder(orderId, 'PICKED_UP'));
        else if (o.state === 'PICKED_UP') fire(orderId, { state: 'OUT_FOR_DELIVERY' }, () => api.advanceOrder(orderId, 'OUT_FOR_DELIVERY'));
        else if (o.state === 'CONFIRMATION_RECEIVED') fire(orderId, { state: 'DELIVERED' }, () => api.completeOrder(orderId));
      },

      arrive: (orderId) => fire(orderId, { state: 'ARRIVED' }, () => api.arriveOrder(orderId)),

      // the old code stays on screen until get_order_private brings the new one
      refreshPin: (orderId) => fire(orderId, null, () => api.refreshPin(orderId)),

      confirmHandover: async (orderId, code) => {
        try {
          const r = await write(orderId, null, () => api.verifyHandover(orderId, code));
          if (r === 'ok') {
            const cur = get().orders[orderId];
            if (cur) put({ ...cur, state: 'CONFIRMATION_RECEIVED', updatedAt: now() });
          }
          return r;
        } catch (e) {
          // not_allowed: no longer this courier's order at the door — the re-sync shows why
          return toApiError(e).code === 'offline' ? 'offline' : 'wrong';
        }
      },

      // waits for the server: if the courier picked up meanwhile, nothing changes on screen
      cancel: async (orderId) => {
        try {
          const ok = await write(orderId, null, () => api.cancelOrder(orderId));
          const cur = get().orders[orderId];
          if (ok && cur) put({ ...cur, state: 'CANCELLED', updatedAt: now() });
          return ok;
        } catch (e) {
          console.warn('cancel', toApiError(e).code);
          return false;
        }
      },
      rate: (orderId, rating) => fire(orderId, { rating }, () => api.rateOrder(orderId, rating)),

      setDriverPhone: (orderId, phone) => {
        const p = phone.trim() || undefined;
        if (get().orders[orderId]?.driverPhone === p) return;
        fire(orderId, { driverPhone: p }, () => api.setDriverPhone(orderId, p ?? ''));
      },

      report: (orderId, reason, note) => {
        const o = get().orders[orderId];
        const u = me();
        if (!o || !u) return;
        const report = { by: o.courierId === u.id ? ('courier' as const) : ('customer' as const), reason, note: note || undefined, at: now() };
        const local: Partial<Order> =
          report.by === 'courier'
            ? { report, courierId: undefined, courierName: undefined, courierUpi: undefined, courierPhone: undefined, otp: undefined, state: 'ORDER_PLACED' }
            : { report, state: 'DISPUTED' };
        fire(orderId, local, () => api.reportOrder(orderId, reason, note));
      },

      reset: () => {
        for (const k of Object.keys(privateAt)) delete privateAt[k];
        set({ orders: {} });
      },
    }),
    {
      // v2: orders from the old backend use reg numbers as identity; start clean
      name: 'onmyway.orders.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ orders: s.orders, fares: s.fares }),
    },
  ),
);
