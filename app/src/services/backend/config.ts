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

/**
 * Google / Microsoft come back to the app through a redirect, so they need PKCE. The email code
 * is typed into the app and never travels in a link, so PKCE has nothing to protect there.
 */
export const USES_REDIRECT = SIGN_IN_METHOD !== 'email_code';

/** Must match Supabase -> Authentication -> Providers -> Email -> "Email OTP Length". */
export const OTP_LENGTH = Number(process.env.EXPO_PUBLIC_OTP_LENGTH) || 6;
