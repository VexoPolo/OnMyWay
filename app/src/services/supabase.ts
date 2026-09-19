import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// The anon key is public by design (it ships in every client); RLS on the project is what gates access.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://old-project-removed.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'OLD_ANON_KEY_REMOVED';

/** Sign-in is reg number + OTP handled by us, not Supabase Auth, so no session to persist. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
