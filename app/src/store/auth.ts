import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import type { Profile, Role, User } from './types';

interface AuthState {
  user: User | null;
  pendingRegNo: string | null; // between sign-in and OTP
  pendingProfile: Profile | null; // from registration, applied after OTP
  token: string | null;
  signIn: (regNo: string) => void;
  register: (p: Profile) => void;
  verifyOtp: (token: string, name: string) => void;
  setRole: (role: Role) => void;
  setOnline: (online: boolean) => void;
  setUpi: (upi: string) => void;
  signOut: () => void;
}

/** Mirror the profile into public.users (email is the unique key there). */
function pushProfile(u: User) {
  supabase
    .from('users')
    .upsert(
      { email: u.email ?? `${u.regNo.toLowerCase()}@vitstudent.ac.in`, full_name: u.name, reg_number: u.regNo, phone: u.phone ?? '', hostel_block: u.block ?? '', room_number: '', upi_vpa: u.upi ?? null },
      { onConflict: 'email' },
    )
    .then(({ error }) => error && console.warn('users upsert', error.message));
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingRegNo: null,
      pendingProfile: null,
      token: null,
      signIn: (regNo) => set({ pendingRegNo: regNo.trim().toUpperCase(), pendingProfile: null }),
      register: (p) => set({ pendingRegNo: p.regNo.trim().toUpperCase(), pendingProfile: p }),
      verifyOtp: (token, name) => {
        const fresh = !!get().pendingProfile;
        set((s) => ({
          token,
          pendingRegNo: null,
          pendingProfile: null,
          user: { ...s.pendingProfile, regNo: s.pendingRegNo ?? 'UNKNOWN', name: s.pendingProfile?.name ?? name, role: null, online: false },
        }));
        const u = get().user!;
        if (fresh) return pushProfile(u);
        // Returning student on a new phone: pull what they registered with.
        supabase
          .from('users')
          .select('full_name,email,phone,hostel_block,upi_vpa')
          .eq('reg_number', u.regNo)
          .limit(1)
          .then(({ data }) => {
            const r = data?.[0];
            if (!r) return;
            set((s) =>
              s.user?.regNo === u.regNo
                ? { user: { ...s.user, name: r.full_name ?? s.user.name, email: r.email ?? s.user.email, phone: r.phone ?? s.user.phone, block: r.hostel_block ?? s.user.block, upi: r.upi_vpa ?? s.user.upi } }
                : {},
            );
          });
      },
      setRole: (role) => set((s) => (s.user ? { user: { ...s.user, role } } : {})),
      setOnline: (online) => set((s) => (s.user ? { user: { ...s.user, online } } : {})),
      setUpi: (upi) => {
        set((s) => (s.user ? { user: { ...s.user, upi: upi.trim() || undefined } } : {}));
        const u = get().user;
        if (u) supabase.from('users').update({ upi_vpa: u.upi ?? null }).eq('reg_number', u.regNo).then(() => undefined);
      },
      signOut: () => set({ user: null, token: null, pendingRegNo: null, pendingProfile: null }),
    }),
    { name: 'onmyway.auth', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
