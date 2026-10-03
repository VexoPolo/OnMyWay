/**
 * Every backend failure becomes an ApiError with a stable `code`. The database functions raise
 * short codes as their message (see supabase/migrations/0003_functions.sql); Auth and the
 * network are mapped here so screens only ever switch on `code`.
 */
export type ErrorCode =
  // database functions
  | 'not_signed_in'
  | 'email_not_allowed'
  | 'profile_required'
  | 'reg_no_taken'
  | 'reg_no_locked'
  | 'invalid_profile'
  | 'invalid_size'
  | 'invalid_order'
  | 'tracking_required'
  | 'too_many_open_orders'
  | 'not_allowed'
  // auth
  | 'code_invalid'
  | 'rate_limited'
  | 'provider_disabled'
  // transport
  | 'offline'
  | 'unknown';

const DB_CODES = new Set<ErrorCode>([
  'not_signed_in',
  'email_not_allowed',
  'profile_required',
  'reg_no_taken',
  'reg_no_locked',
  'invalid_profile',
  'invalid_size',
  'invalid_order',
  'tracking_required',
  'too_many_open_orders',
  'not_allowed',
]);

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turn anything thrown or returned by supabase-js into an ApiError. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const msg = String((e as { message?: unknown })?.message ?? e ?? '');
  if (DB_CODES.has(msg as ErrorCode)) return new ApiError(msg as ErrorCode, msg);
  // the sign-up trigger in 0001 rejects the insert; GoTrue reports it generically
  if (/not allowed on OnMyWay|Database error (saving|creating) new user/i.test(msg)) return new ApiError('email_not_allowed', msg);
  if (/token has expired or is invalid|otp.*(expired|invalid)/i.test(msg)) return new ApiError('code_invalid', msg);
  if (/rate limit|only request this after|too many requests/i.test(msg)) return new ApiError('rate_limited', msg);
  if (/provider is not enabled|unsupported provider/i.test(msg)) return new ApiError('provider_disabled', msg);
  if (/JWT|not authenticated|permission denied/i.test(msg)) return new ApiError('not_signed_in', msg);
  if (/network request failed|failed to fetch|fetch failed|timed? ?out/i.test(msg)) return new ApiError('offline', msg);
  return new ApiError('unknown', msg || 'Something went wrong');
}

/** Plain-English copy for each code. Screens may override per context. */
export const ERROR_COPY: Record<ErrorCode, string> = {
  not_signed_in: 'Your session ended. Sign in again.',
  email_not_allowed: 'Use your VIT student email to sign in.',
  profile_required: 'Finish your profile first.',
  reg_no_taken: 'That registration number is already registered.',
  reg_no_locked: "Your registration number can't be changed.",
  invalid_profile: 'Check your details and try again.',
  invalid_size: 'Pick a parcel size.',
  invalid_order: 'Check the order details and try again.',
  tracking_required: 'Add the tracking ID for Amazon pickups.',
  too_many_open_orders: 'You already have 5 open orders. Wait for one to finish.',
  not_allowed: "You can't do that on this order.",
  code_invalid: 'That code is wrong or has expired. Request a new one.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  provider_disabled: "That sign-in option isn't switched on yet.",
  offline: "Can't reach the server. Check your connection and try again.",
  unknown: 'Something went wrong. Try again.',
};
