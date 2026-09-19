import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      pendingRegNo: null,
      pendingProfile: null,
      token: null,
      signIn: (regNo) => set({ pendingRegNo: regNo.trim().toUpperCase(), pendingProfile: null }),
      register: (p) => set({ pendingRegNo: p.regNo.trim().toUpperCase(), pendingProfile: p }),
      verifyOtp: (token, name) =>
        set((s) => ({
          token,
          pendingRegNo: null,
          pendingProfile: null,
          user: { ...s.pendingProfile, regNo: s.pendingRegNo ?? 'UNKNOWN', name: s.pendingProfile?.name ?? name, role: null, online: false },
        })),
      setRole: (role) => set((s) => (s.user ? { user: { ...s.user, role } } : {})),
      setOnline: (online) => set((s) => (s.user ? { user: { ...s.user, online } } : {})),
      setUpi: (upi) => set((s) => (s.user ? { user: { ...s.user, upi: upi.trim() || undefined } } : {})),
      signOut: () => set({ user: null, token: null, pendingRegNo: null, pendingProfile: null }),
    }),
    { name: 'onmyway.auth', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
