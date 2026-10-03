import type { Session } from '@supabase/supabase-js';
import { db } from './client';
import { toApiError } from './errors';

/**
 * Sign-in is swappable. The database only ever looks at auth.uid() and the account's verified
 * email (checked against app_config.allowed_email_domains), so any of these methods works with
 * the same tables and functions. Pick one with EXPO_PUBLIC_SIGN_IN_METHOD.
 *
 *   email_code — 6-digit code by email (Supabase Auth + Brevo SMTP). Default.
 *   google     — "Sign in with Google". Needs the Google provider enabled in Supabase.
 *   microsoft  — "Sign in with Microsoft" (Supabase calls it `azure`). VIT student mail is
 *                Microsoft 365, so this works even if VIT's mail servers block our emails.
 */
export type SignInMethod = 'email_code' | 'google' | 'microsoft';

const METHODS: readonly SignInMethod[] = ['email_code', 'google', 'microsoft'];
const fromEnv = process.env.EXPO_PUBLIC_SIGN_IN_METHOD as SignInMethod | undefined;
export const SIGN_IN_METHOD: SignInMethod = fromEnv && METHODS.includes(fromEnv) ? fromEnv : 'email_code';

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

export async function signOut(): Promise<void> {
  const { error } = await db.auth.signOut();
  if (error) throw toApiError(error);
}
