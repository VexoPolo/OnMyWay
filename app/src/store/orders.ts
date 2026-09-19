import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { estimateKm } from '../services/mock';
import { supabase } from '../services/supabase';
import { useAuth } from './auth';
import type { Order, OrderState, PackageSize } from './types';

// Priced by parcel class only: Regular (S/M) ₹20, Large (L/XL) ₹30.
const SIZE_BASE: Record<PackageSize, number> = { S: 20, M: 20, L: 30, XL: 30 };
const PER_KM = 0;
const PIN_TTL = 5 * 60_000;

/** Fare is quoted before the order is placed and goes to the courier. */
export function quoteFare(size: PackageSize, distanceKm: number): number {
  return Math.round((SIZE_BASE[size] + PER_KM * distanceKm) / 5) * 5;
}

export function platformOf(trackingId?: string) {
  const t = trackingId ?? '';
  return t.startsWith('TBA') ? 'Amazon' : t.startsWith('FLP') ? 'Flipkart' : t.startsWith('MYN') ? 'Myntra' : 'Courier';
}

const NEXT: Partial<Record<OrderState, OrderState>> = {
  ORDER_PLACED: 'AGENT_ASSIGNED',
  AGENT_ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'ARRIVED',
  ARRIVED: 'CONFIRMATION_RECEIVED', // handover verified — courier still has to collect the fare
  CONFIRMATION_RECEIVED: 'DELIVERED', // slide-to-complete
};

// ---------------------------------------------------------------------------
// Wire format: the public.orders table (the earlier web apps speak the same vocabulary).
// Columns beyond his original ones come from web/supabase/001_onmyway_orders.sql.
// Writes drop any column the live table doesn't have yet. Until that file is applied
// the same fields also travel as JSON in `delivery_otp` (a column nobody uses), so
// both phones still see courier, fare, pickup OTP, PIN expiry, rating and reports.
// Real columns win over the sidecar once they exist.
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const SIDECAR = 'delivery_otp';

const TO_STATUS: Record<OrderState, string> = {
  ORDER_PLACED: 'available',
  AGENT_ASSIGNED: 'allocated',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'on_the_way',
  ARRIVED: 'reached',
  CONFIRMATION_RECEIVED: 'handed_over',
  PAID: 'handed_over',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
};
const FROM_STATUS: Record<string, OrderState> = {
  available: 'ORDER_PLACED',
  pending: 'ORDER_PLACED',
  PENDING: 'ORDER_PLACED',
  allocated: 'AGENT_ASSIGNED',
  picked_up: 'PICKED_UP',
  on_the_way: 'OUT_FOR_DELIVERY',
  reached: 'ARRIVED',
  handed_over: 'CONFIRMATION_RECEIVED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  disputed: 'DISPUTED',
};
const TO_SIZE: Record<PackageSize, string> = { S: 'Small', M: 'Regular', L: 'Large', XL: 'Extra large' };
function fromSize(v: unknown): PackageSize {
  const t = String(v ?? '').toLowerCase();
  return t.startsWith('s') ? 'S' : t.startsWith('l') ? 'L' : t.startsWith('x') || t.startsWith('e') ? 'XL' : 'M';
}
// The web forms also know 'Amazon Kiosk' / 'SJ Gate'; the app has two points.
const fromPoint = (v: unknown) => (/amazon/i.test(String(v ?? '')) ? 'Amazon Pick Up Point' : 'Main Gate');
const iso = (t = Date.now()) => new Date(t).toISOString();
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

function sidecarOf(o: Order): string {
  return JSON.stringify({
    rr: o.customerRegNo, cr: o.courierRegNo, cn: o.courierName, cu: o.courierUpi, fee: o.fare,
    po: o.pickupOtp, px: o.otp?.expiresAt, up: o.updatedAt, rt: o.rating, rp: o.report,
  });
}

function fromRow(r: Row): Order {
  let x: Row = {};
  try {
    if (typeof r[SIDECAR] === 'string' && r[SIDECAR].startsWith('{')) x = JSON.parse(r[SIDECAR]);
  } catch {}
  const pickup = fromPoint(r.pickup_point);
  const block: string = r.hostel_delivery_block ?? '';
  const size = fromSize(r.order_size);
  const distanceKm = estimateKm(pickup, block);
  const createdAt = Date.parse(r.created_at) || Date.now();
  const updatedAt = r.updated_at ? Date.parse(r.updated_at) : (x.up ?? createdAt);
  const courierRegNo = r.rider_reg_no ?? x.cr ?? undefined;
  const pinExpiry = r.pin_expires_at ? Date.parse(r.pin_expires_at) : (x.px ?? updatedAt + PIN_TTL);
  const report = r.report_reason
    ? { by: r.report_by === 'courier' ? 'courier' : 'customer', reason: r.report_reason, note: r.report_note ?? undefined, at: r.reported_at ? Date.parse(r.reported_at) : updatedAt }
    : x.rp ?? undefined;
  return {
    id: r.id,
    trackingId: r.tracking_id ?? undefined,
    platform: platformOf(r.tracking_id),
    customerRegNo: r.requester_reg_no ?? x.rr ?? r.requester_phone ?? '',
    customerName: r.recipient_name ?? undefined,
    customerPhone: r.requester_phone ?? undefined,
    courierRegNo,
    courierName: r.rider_name ?? (courierRegNo ? x.cn : undefined) ?? undefined,
    courierUpi: r.rider_upi ?? (courierRegNo ? x.cu : undefined) ?? undefined,
    size,
    pickup,
    dropoff: block ? (/block/i.test(block) ? block : `${block} block`) : 'Your block',
    distanceKm,
    fare: r.delivery_fee ?? x.fee ?? quoteFare(size, distanceKm),
    note: r.special_instructions || r.order_instructions || undefined,
    pickupOtp: r.pickup_otp ?? x.po ?? undefined,
    state: FROM_STATUS[r.delivery_status] ?? 'ORDER_PLACED',
    createdAt,
    updatedAt,
    otp: r.delivery_pin ? { code: String(r.delivery_pin), expiresAt: pinExpiry } : undefined,
    rating: r.rating ?? x.rt ?? undefined,
    report,
  };
}

function toRow(o: Order): Row {
  return {
    id: o.id,
    tracking_id: o.trackingId ?? null,
    pickup_point: o.pickup,
    order_size: TO_SIZE[o.size],
    recipient_name: o.customerName ?? '',
    requester_phone: o.customerPhone ?? '',
    hostel_delivery_block: o.dropoff.replace(/ block$/i, ''),
    special_instructions: o.note ?? '',
    delivery_status: TO_STATUS[o.state],
    // --- added by 001_onmyway_orders.sql
    requester_reg_no: o.customerRegNo,
    delivery_fee: o.fare,
    pickup_otp: o.pickupOtp ?? null,
    updated_at: iso(o.updatedAt),
    [SIDECAR]: sidecarOf(o),
  };
}

function merge(prev: Order | undefined, next: Order): Order {
  if (!prev) return next;
  return { ...next, otp: next.otp && prev.otp?.code === next.otp.code ? prev.otp : next.otp };
}

const MISSING_COL = /Could not find the '(\w+)' column/;
type Res = { data: Row[] | null; error: { message: string } | null };
/** Runs a write; if PostgREST rejects a column the live table lacks, retries without it. */
async function tolerant(run: (payload: Row) => PromiseLike<Res>, payload: Row): Promise<Res> {
  for (let i = 0; i < 16; i++) {
    const res = await run(payload);
    const col = res.error && MISSING_COL.exec(res.error.message)?.[1];
    if (!col) return res;
    payload = { ...payload };
    delete payload[col];
  }
  return { data: null, error: { message: 'too many unknown columns' } };
}

// ---------------------------------------------------------------------------

interface OrdersState {
  orders: Record<string, Order>;
  place: (draft: Omit<Order, 'id' | 'state' | 'createdAt' | 'updatedAt' | 'fare'>) => Order;
  /** First-come-first-served: one conditional UPDATE on the server, so two phones can't both win. */
  accept: (orderId: string, courierRegNo: string, courierUpi?: string) => Promise<'ok' | 'taken' | 'missing' | 'offline'>;
  advance: (orderId: string) => void;
  arrive: (orderId: string) => string; // generates the handover PIN, returns it (the customer reads it off the row)
  confirmHandover: (orderId: string, code: string) => Promise<'ok' | 'wrong' | 'expired'>;
  cancel: (orderId: string) => void;
  rate: (orderId: string, rating: number) => void;
  /** Customer report flags the order DISPUTED. Courier report releases it back to the pool. */
  report: (orderId: string, by: 'customer' | 'courier', reason: string, note?: string) => void;
  reset: () => void;
}

const now = () => Date.now();
// Bumped on every local write; a fetch that started before a write is thrown away so it can't undo it.
let seq = 0;

function applyRows(rows: Row[]) {
  useOrders.setState((s) => {
    const orders = { ...s.orders };
    for (const r of rows) orders[r.id] = merge(orders[r.id], fromRow(r));
    return { orders };
  });
}

/** Pull the last week. Replaces the cache wholesale so rows deleted on the server disappear too. */
export async function sync() {
  const at = seq;
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', iso(now() - 7 * 86_400_000))
    .order('created_at', { ascending: false })
    .limit(300);
  if (error || !data || at !== seq) return;
  useOrders.setState((s) => {
    const orders: Record<string, Order> = {};
    for (const r of data) orders[r.id] = merge(s.orders[r.id], fromRow(r));
    return { orders };
  });
}

/** Optimistic local change + the matching server write. Any failure re-syncs from the server. */
function patch(orderId: string, local: Partial<Order>, remote: Row) {
  seq++;
  useOrders.setState((s) => {
    const o = s.orders[orderId];
    return o ? { orders: { ...s.orders, [orderId]: { ...o, ...local, updatedAt: now() } } } : {};
  });
  const o = useOrders.getState().orders[orderId];
  if (!o) return;
  tolerant((p) => supabase.from('orders').update(p).eq('id', orderId).select(), { ...remote, updated_at: iso(), [SIDECAR]: sidecarOf(o) })
    .then(({ data, error }) => (error || !data?.length ? sync() : applyRows(data)))
    .catch(sync);
}

/** Live feed: initial pull, realtime rows as they change, and a slow poll as a safety net. Returns a stop fn. */
export function startSync() {
  sync();
  const ch = supabase
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => {
      if (p.eventType === 'DELETE') {
        const id = (p.old as Row).id;
        useOrders.setState((s) => {
          const { [id]: _gone, ...rest } = s.orders;
          return { orders: rest };
        });
      } else applyRows([p.new as Row]);
    })
    .subscribe();
  const timer = setInterval(() => AppState.currentState === 'active' && sync(), 4000);
  const sub = AppState.addEventListener('change', (st) => st === 'active' && sync());
  return () => {
    supabase.removeChannel(ch);
    clearInterval(timer);
    sub.remove();
  };
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: {},
      place: (draft) => {
        const order: Order = {
          ...draft,
          id: uuid(),
          fare: quoteFare(draft.size, draft.distanceKm),
          state: 'ORDER_PLACED',
          createdAt: now(),
          updatedAt: now(),
        };
        seq++;
        set((s) => ({ orders: { ...s.orders, [order.id]: order } }));
        tolerant((p) => supabase.from('orders').insert(p).select(), toRow(order))
          .then(({ data, error }) => {
            if (error) {
              console.warn('place failed', error.message);
              set((s) => {
                const { [order.id]: _gone, ...rest } = s.orders;
                return { orders: rest };
              });
              return;
            }
            if (data?.length) applyRows(data);
          })
          .catch((e) => console.warn('place failed', e));
        return order;
      },
      accept: async (orderId, courierRegNo, courierUpi) => {
        const o = get().orders[orderId];
        if (!o) return 'missing';
        if (o.state !== 'ORDER_PLACED') return 'taken';
        const courierName = useAuth.getState().user?.name;
        seq++;
        // The conditional write: only succeeds if still unassigned.
        const taken: Order = { ...o, courierRegNo, courierName, courierUpi, state: 'AGENT_ASSIGNED', updatedAt: now() };
        const { data, error } = await tolerant(
          (p) => supabase.from('orders').update(p).eq('id', orderId).eq('delivery_status', 'available').select(),
          { delivery_status: 'allocated', rider_reg_no: courierRegNo, rider_name: courierName ?? null, rider_upi: courierUpi ?? null, updated_at: iso(), [SIDECAR]: sidecarOf(taken) },
        );
        if (error) return 'offline';
        if (!data?.length) {
          sync();
          return 'taken';
        }
        set((s) => ({ orders: { ...s.orders, [orderId]: taken } }));
        applyRows(data);
        return 'ok';
      },
      advance: (orderId) => {
        const o = get().orders[orderId];
        const next = o && NEXT[o.state];
        if (!o || !next) return;
        patch(orderId, { state: next }, { delivery_status: TO_STATUS[next] });
      },
      arrive: (orderId) => {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = now() + PIN_TTL;
        patch(orderId, { state: 'ARRIVED', otp: { code, expiresAt } }, { delivery_status: 'reached', delivery_pin: code, pin_expires_at: iso(expiresAt) });
        return code;
      },
      confirmHandover: async (orderId, code) => {
        const o = get().orders[orderId];
        if (!o?.otp) return 'wrong';
        if (now() > o.otp.expiresAt) return 'expired';
        seq++;
        // Verified by the database: the row only changes if the PIN on it matches.
        const { data, error } = await tolerant(
          (p) => supabase.from('orders').update(p).eq('id', orderId).eq('delivery_status', 'reached').eq('delivery_pin', code).select(),
          { delivery_status: 'handed_over', updated_at: iso(), [SIDECAR]: sidecarOf({ ...o, updatedAt: now() }) },
        );
        if (error || !data?.length) {
          sync();
          return 'wrong';
        }
        set((s) => ({ orders: { ...s.orders, [orderId]: { ...s.orders[orderId], state: 'CONFIRMATION_RECEIVED', updatedAt: now() } } }));
        applyRows(data);
        return 'ok';
      },
      cancel: (orderId) => patch(orderId, { state: 'CANCELLED' }, { delivery_status: 'cancelled' }),
      rate: (orderId, rating) => patch(orderId, { rating }, { rating }),
      report: (orderId, by, reason, note) => {
        const report = { by, reason, note: note || undefined, at: now() };
        const remote = { report_by: by, report_reason: reason, report_note: note || null, reported_at: iso() };
        if (by === 'courier') {
          patch(
            orderId,
            { report, courierRegNo: undefined, courierName: undefined, courierUpi: undefined, otp: undefined, state: 'ORDER_PLACED' },
            { ...remote, delivery_status: 'available', rider_reg_no: null, rider_name: null, rider_upi: null, delivery_pin: null, pin_expires_at: null },
          );
        } else {
          patch(orderId, { report, state: 'DISPUTED' }, { ...remote, delivery_status: 'disputed' });
        }
      },
      reset: () => set({ orders: {} }),
    }),
    { name: 'onmyway.orders', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
