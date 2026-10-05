import type { Session } from '@supabase/supabase-js';
import { db } from './client';
import { USES_REDIRECT } from './config';
import { ApiError, toApiError } from './errors';

// Which method is on, and the code length, live in config.ts (client.ts needs them too).
export { OTP_LENGTH, SIGN_IN_METHOD, type SignInMethod } from './config';

// ---- email code -----------------------------------------------------------------------------

/** Step 1: email a 6-digit code. Creates the account on first use (the domain gate runs then). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await db.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) throw toApiError(error);
}

/** Step 2: the code from the email. On success the session is stored on the device. */
export async function verifyEmailCode(email: string, code: string): Promise<Session> {
  const { data, error } = await db.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error || !data.session) throw toApiError(error ?? new Error('Token has expired or is invalid'));
  return data.session;
}

// ---- Google / Microsoft (OAuth, PKCE) --------------------------------------------------------

/**
 * Step 1: get the provider's sign-in page URL. The caller opens it (e.g. expo-web-browser's
 * openAuthSessionAsync) with `redirectTo` registered as a deep link for the app, and in
 * Supabase -> Auth -> URL Configuration -> Redirect URLs.
 */
export async function startOAuth(method: 'google' | 'microsoft', redirectTo: string): Promise<string> {
  if (!USES_REDIRECT) {
    throw new ApiError('provider_disabled', 'Set EXPO_PUBLIC_SIGN_IN_METHOD to google or microsoft (turns PKCE on).');
  }
  // Without WebCrypto, supabase-js silently downgrades the PKCE challenge to "plain". Refuse
  // instead: install a WebCrypto polyfill (e.g. one built on expo-crypto) before enabling this.
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new ApiError('provider_disabled', 'WebCrypto missing: add a crypto.subtle polyfill before using redirect sign-in.');
  }
  const { data, error } = await db.auth.signInWithOAuth({
    provider: method === 'microsoft' ? 'azure' : 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Microsoft only returns the email when asked for it
      scopes: method === 'microsoft' ? 'email openid profile' : undefined,
      // Google: show only the student's VIT account in the chooser. A hint, not a gate —
      // the database still enforces the allowed domains.
      queryParams: method === 'google' ? { hd: 'vitstudent.ac.in' } : undefined,
    },
  });
  if (error || !data.url) throw toApiError(error ?? new Error('provider is not enabled'));
  return data.url;
}

/** Step 2: the URL the browser came back to. Exchanges its `code` for a session. */
export async function finishOAuth(returnUrl: string): Promise<Session> {
  const code = new URL(returnUrl).searchParams.get('code');
  if (!code) throw toApiError(new Error('Token has expired or is invalid'));
  const { data, error } = await db.auth.exchangeCodeForSession(code);
  if (error || !data.session) throw toApiError(error ?? new Error('Token has expired or is invalid'));
  return data.session;
}

// ---- session --------------------------------------------------------------------------------

export async function getSession(): Promise<Session | null> {
  const { data } = await db.auth.getSession();
  return data.session;
}

/** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe fn. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  const { data } = db.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** This phone only: the student's other devices stay signed in. */
export async function signOut(): Promise<void> {
  const { error } = await db.auth.signOut({ scope: 'local' });
  if (error) throw toApiError(error);
}
