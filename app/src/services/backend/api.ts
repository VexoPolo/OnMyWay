import type { RealtimeChannel } from '@supabase/supabase-js';
import type { OrderState, PackageSize } from '../../store/types';
import type { PickupPoint } from '../mock';
import { db } from './client';
import type { DbOrder, DbOrderEvent, DbProfile } from './database.types';
import { ApiError, toApiError } from './errors';

/*
 * Everything the app asks of the backend. No function here sends a user id or reg number:
 * the database works out who is calling from the signed-in session (auth.uid()).
 * Errors throw ApiError (see errors.ts); expected outcomes ("taken", "wrong") are return values.
 */

// ---- domain types ---------------------------------------------------------------------------

export interface Profile {
  id: string;
  regNo: string;
  name: string;
  phone: string;
  block: string;
  upi?: string;
}

/** The public part of an order: what RLS lets this user read straight from the table. */
export interface OrderRecord {
  id: string;
  customerId: string;
  courierId?: string;
  pickup: PickupPoint;
  trackingId: string;
  platform: string;
  size: PackageSize;
  dropoff: string;
  note?: string;
  fare: number;
  state: OrderState;
  pinExpiresAt?: number;
  rating?: number;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number;
  pickedUpAt?: number;
  onTheWayAt?: number;
  arrivedAt?: number;
  handedOverAt?: number;
  deliveredAt?: number;
  cancelledAt?: number;
}

/** What only the two people on an order get (get_order_private). */
export interface OrderPrivate {
  myRole: 'customer' | 'courier';
  /** customer only, and only while the courier is at the door */
  pin?: { code: string; expiresAt: number };
  pinAttemptsLeft: number;
  pickupOtp?: string;
  driverPhone?: string;
  /** the courier (for the customer) or the customer (for the courier) */
  other?: { name: string; regNo?: string; phone?: string; upi?: string };
}

export interface OrderEvent {
  id: number;
  orderId: string;
  actorId?: string;
  event: string;
  from?: OrderState;
  to?: OrderState;
  detail: Record<string, unknown>;
  at: number;
}

export type AcceptResult = 'ok' | 'taken' | 'missing' | 'limit' | 'own';
export type VerifyResult = 'ok' | 'wrong' | 'expired' | 'locked';

// ---- wire <-> app -------------------------------------------------------------------------

const FROM_STATUS: Record<string, OrderState> = {
  available: 'ORDER_PLACED',
  allocated: 'AGENT_ASSIGNED',
  picked_up: 'PICKED_UP',
  on_the_way: 'OUT_FOR_DELIVERY',
  reached: 'ARRIVED',
  handed_over: 'CONFIRMATION_RECEIVED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  disputed: 'DISPUTED',
};

const ms = (t: string | null | undefined) => (t ? Date.parse(t) : undefined);

function toProfile(r: DbProfile): Profile {
  return { id: r.id, regNo: r.reg_no, name: r.full_name, phone: r.phone, block: r.hostel_block, upi: r.upi_vpa ?? undefined };
}

export function toOrder(r: DbOrder): OrderRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    courierId: r.courier_id ?? undefined,
    pickup: r.pickup_point as PickupPoint,
    trackingId: r.tracking_id,
    platform: r.platform,
    size: r.size as PackageSize,
    dropoff: r.drop_block,
    note: r.note || undefined,
    fare: r.fare,
    state: FROM_STATUS[r.status] ?? 'ORDER_PLACED',
    pinExpiresAt: ms(r.pin_expiry),
    rating: r.rating ?? undefined,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
    acceptedAt: ms(r.accepted_at),
    pickedUpAt: ms(r.picked_up_at),
    onTheWayAt: ms(r.on_the_way_at),
    arrivedAt: ms(r.arrived_at),
    handedOverAt: ms(r.handed_over_at),
    deliveredAt: ms(r.delivered_at),
    cancelledAt: ms(r.cancelled_at),
  };
}

// supabase-js resolves to { data: T, error: null } | { data: null, error: E }; take R whole so
// TypeScript keeps T (matching against `T | null` directly makes it infer `never`).
type Res = { data: unknown; error: unknown };

/** Unwrap a supabase-js result that may legitimately be empty (maybeSingle). Throws ApiError on error. */
async function callMaybe<R extends Res>(p: PromiseLike<R>): Promise<R['data'] | null> {
  let res: R;
  try {
    res = await p;
  } catch (e) {
    throw toApiError(e);
  }
  if (res.error) throw toApiError(res.error);
  return res.data ?? null;
}

/** Same, for calls that always return something: an empty answer is an error. */
async function call<R extends Res>(p: PromiseLike<R>): Promise<NonNullable<R['data']>> {
  const data = await callMaybe(p);
  if (data === null || data === undefined) throw new ApiError('unknown', 'Empty response from the server');
  return data as NonNullable<R['data']>;
}

async function myId(): Promise<string> {
  const { data } = await db.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError('not_signed_in', 'not_signed_in');
  return id;
}

// ---- profile --------------------------------------------------------------------------------

/** null = signed in but no profile yet (send them to registration). */
export async function getMyProfile(): Promise<Profile | null> {
  const id = await myId();
  const row = await callMaybe(db.from('profiles').select('*').eq('id', id).maybeSingle());
  return row ? toProfile(row) : null;
}

/** Create or update. The reg number can only be set once (reg_no_locked after that). */
export async function saveProfile(p: { regNo: string; name: string; phone: string; block: string; upi?: string }): Promise<Profile> {
  const row = await call(
    db.rpc('save_profile', { p_reg_no: p.regNo, p_full_name: p.name, p_phone: p.phone, p_hostel_block: p.block, p_upi: p.upi ?? '' }),
  );
  return toProfile(row);
}

// ---- orders: reads --------------------------------------------------------------------------

/**
 * Everything this user may see from the last `days` days: their own orders, their jobs as a
 * courier, and the open pool. RLS does the filtering.
 */
export async function listOrders(days = 7): Promise<OrderRecord[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await call(db.from('orders').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(300));
  return rows.map(toOrder);
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  const row = await callMaybe(db.from('orders').select('*').eq('id', orderId).maybeSingle());
  return row ? toOrder(row) : null;
}

/** PIN, pickup code, phones, the other person. null if you're not on this order. */
export async function getOrderPrivate(orderId: string): Promise<OrderPrivate | null> {
  const rows = await call(db.rpc('get_order_private', { p_order: orderId }));
  const r = rows?.[0];
  if (!r) return null;
  const expiresAt = ms(r.pin_expiry);
  return {
    myRole: r.my_role === 'courier' ? 'courier' : 'customer',
    pin: r.delivery_pin && expiresAt ? { code: r.delivery_pin, expiresAt } : undefined,
    pinAttemptsLeft: r.pin_attempts_left,
    pickupOtp: r.pickup_otp ?? undefined,
    driverPhone: r.driver_phone ?? undefined,
    other: r.other_name
      ? { name: r.other_name, regNo: r.other_reg_no ?? undefined, phone: r.other_phone ?? undefined, upi: r.other_upi ?? undefined }
      : undefined,
  };
}

/** Your latest report on an order (RLS: you only ever see reports you filed). */
export async function getMyReport(
  orderId: string,
): Promise<{ by: 'customer' | 'courier'; reason: string; note?: string; at: number } | null> {
  const r = await callMaybe(
    db.from('reports').select('*').eq('order_id', orderId).order('id', { ascending: false }).limit(1).maybeSingle(),
  );
  return r ? { by: r.reporter_role === 'courier' ? 'courier' : 'customer', reason: r.reason, note: r.note || undefined, at: Date.parse(r.created_at) } : null;
}

/** The audit trail of one order (only the customer and courier on it can read it). */
export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const rows = await call(db.from('order_events').select('*').eq('order_id', orderId).order('id'));
  return rows.map(
    (r: DbOrderEvent): OrderEvent => ({
      id: r.id,
      orderId: r.order_id,
      actorId: r.actor_id ?? undefined,
      event: r.event,
      from: r.from_status ? FROM_STATUS[r.from_status] : undefined,
      to: r.to_status ? FROM_STATUS[r.to_status] : undefined,
      detail: (r.detail ?? {}) as Record<string, unknown>,
      at: Date.parse(r.created_at),
    }),
  );
}

/**
 * Live changes to any order this user can see. RLS applies to realtime too, so a phone only
 * hears about its own orders, its jobs, and the open pool. Returns an unsubscribe fn.
 * Note: an order that LEAVES your view (e.g. someone else accepts an open order) arrives as
 * nothing at all — callers should re-run listOrders() on reconnect / app foreground.
 */
export function subscribeOrders(onChange: (o: OrderRecord) => void): () => void {
  const ch: RealtimeChannel = db
    .channel('orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (p) => {
      if (p.eventType !== 'DELETE') onChange(toOrder(p.new as DbOrder));
    })
    .subscribe();
  return () => {
    db.removeChannel(ch);
  };
}

// ---- orders: actions ------------------------------------------------------------------------

/** Server price for a size (Rs 20 for S/M, Rs 30 for L/XL). Show before placing. */
export async function quoteFare(size: PackageSize): Promise<number> {
  return call(db.rpc('quote_fare', { p_size: size }));
}

/** Fare, id, platform, gate reference and drop-off (your profile's block) are all set by the server. */
export async function placeOrder(o: {
  pickup: PickupPoint;
  trackingId?: string;
  size: PackageSize;
  note?: string;
  pickupOtp?: string;
  driverPhone?: string;
}): Promise<OrderRecord> {
  const row = await call(
    db.rpc('place_order', {
      p_pickup_point: o.pickup,
      p_tracking_id: o.trackingId ?? '',
      p_size: o.size,
      p_note: o.note ?? '',
      p_pickup_otp: o.pickupOtp ?? '',
      p_driver_phone: o.driverPhone ?? '',
    }),
  );
  return toOrder(row);
}

/** First tap wins. 'limit' = already carrying 4; 'own' = your own order. */
export async function acceptOrder(orderId: string): Promise<AcceptResult> {
  return (await call(db.rpc('accept_order', { p_order: orderId }))) as AcceptResult;
}

/** Courier: AGENT_ASSIGNED -> PICKED_UP, or PICKED_UP -> OUT_FOR_DELIVERY. false = wrong step. */
export async function advanceOrder(orderId: string, to: 'PICKED_UP' | 'OUT_FOR_DELIVERY'): Promise<boolean> {
  return call(db.rpc('advance_order', { p_order: orderId, p_to: to === 'PICKED_UP' ? 'picked_up' : 'on_the_way' }));
}

/** Courier at the door. The server makes the PIN; only the customer can read it. */
export async function arriveOrder(orderId: string): Promise<boolean> {
  return call(db.rpc('arrive_order', { p_order: orderId }));
}

/** Customer: fresh 5-minute PIN (also clears a lock-out). */
export async function refreshPin(orderId: string): Promise<boolean> {
  return call(db.rpc('refresh_pin', { p_order: orderId }));
}

/** Courier types the customer's PIN. 5 wrong tries -> 'locked' until the customer refreshes. */
export async function verifyHandover(orderId: string, code: string): Promise<VerifyResult> {
  return (await call(db.rpc('verify_handover', { p_order: orderId, p_code: code }))) as VerifyResult;
}

/** Courier: slide-to-complete after the handover. */
export async function completeOrder(orderId: string): Promise<boolean> {
  return call(db.rpc('complete_order', { p_order: orderId }));
}

/** Customer: only before pickup. */
export async function cancelOrder(orderId: string): Promise<boolean> {
  return call(db.rpc('cancel_order', { p_order: orderId }));
}

/** Customer: 1-5 stars, once, after delivery. */
export async function rateOrder(orderId: string, stars: number): Promise<boolean> {
  return call(db.rpc('rate_order', { p_order: orderId, p_stars: stars }));
}

/** Customer: the platform driver's number, while the order is live. */
export async function setDriverPhone(orderId: string, phone: string): Promise<boolean> {
  return call(db.rpc('set_driver_phone', { p_order: orderId, p_phone: phone }));
}

/** Customer report -> DISPUTED. Courier report -> back to the open pool. */
export async function reportOrder(orderId: string, reason: string, note?: string): Promise<boolean> {
  return call(db.rpc('report_order', { p_order: orderId, p_reason: reason, p_note: note ?? '' }));
}

// ---- ID card --------------------------------------------------------------------------------

/**
 * Upload (or replace) the signed-in student's ID card photo. Private bucket, file named by
 * their auth id; only they can read it back (supabase/migrations/0010_id_card_storage.sql).
 */
export async function uploadIdCard(localUri: string, mimeType = 'image/jpeg'): Promise<void> {
  const uid = (await db.auth.getSession()).data.session?.user.id;
  if (!uid) throw new ApiError('not_signed_in', 'not signed in');
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await db.storage.from('id-cards').upload(uid, body, { contentType: mimeType, upsert: true });
  if (error) throw toApiError(error);
}

/** Has the signed-in student uploaded an ID card? Unknown (offline...) counts as yes: never block sign-in on it. */
export async function hasIdCard(): Promise<boolean> {
  const uid = (await db.auth.getSession()).data.session?.user.id;
  if (!uid) return true;
  try {
    const { data } = await db.storage.from('id-cards').exists(uid); // false only on a real 404
    return data;
  } catch {
    return true;
  }
}
