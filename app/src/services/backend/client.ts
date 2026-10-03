import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from './database.types';

// Project fikinghjzmnxgmvnibyk. Both values are public by design (they ship in every build);
// RLS and the database functions are what gate access. Set them in app/.env (see .env.example).
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!URL || !KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. Copy app/.env.example to app/.env.');
}

/**
 * The one Supabase client. Sessions persist on the device and refresh themselves, so a student
 * signs in once. PKCE is on so Google / Microsoft sign-in can be switched on without touching this.
 */
export const db = createClient<Database>(URL, KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// React Native: only refresh tokens while the app is in the foreground (Supabase's guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') db.auth.startAutoRefresh();
  else db.auth.stopAutoRefresh();
});
