import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/backend/api';
import * as auth from '../services/backend/auth';
import { ApiError } from '../services/backend/errors';
import type { Profile, Role, User } from './types';

/** What the code screen does next once the code checks out. */
export type VerifyOutcome = 'signed_in' | 'needs_profile';

interface AuthState {
  /** Set once there is a session AND a saved profile. The navigator keys off this. */
  user: User | null;
  /** Between "send code" and the code screen. */
  pendingEmail: string | null;
  /** From registration; saved to the server right after the code is verified. */
  pendingProfile: Profile | null;
  /** Register: emails a code, or saves straight away if this email is already signed in. */
  register: (p: Profile) => Promise<'code_sent' | 'signed_in'>;
  /** Sign in: emails a code. */
  sendCode: (email: string) => Promise<void>;
  /** The code screen. Throws ApiError (code_invalid, reg_no_taken, ...). */
  verifyCode: (code: string) => Promise<VerifyOutcome>;
  setRole: (role: Role) => void;
  setOnline: (online: boolean) => void;
  /** Local while typing; saveUpi() persists it when the field is left. */
  setUpi: (upi: string) => void;
  saveUpi: () => Promise<void>;
  signOut: () => Promise<void>;
}

function toUser(p: api.Profile, email: string | undefined, prev: User | null): User {
  return {
    id: p.id,
    regNo: p.regNo,
    name: p.name,
    email,
    phone: p.phone,
    block: p.block,
    upi: p.upi,
    // role and the online toggle are this phone's choices, not server data
    role: prev?.id === p.id ? prev.role : null,
    online: prev?.id === p.id ? prev.online : false,
  };
}

async function saveRemote(p: Profile) {
  return api.saveProfile({ regNo: p.regNo.trim().toUpperCase(), name: p.name, phone: p.phone, block: p.block, upi: p.upi });
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingEmail: null,
      pendingProfile: null,

      register: async (p) => {
        const email = p.email.trim().toLowerCase();
        const session = await auth.getSession();
        if (session?.user.email?.toLowerCase() === email) {
          // came back from the code screen to fix a detail: already verified, just save
          const saved = await saveRemote(p);
          set({ user: toUser(saved, email, get().user), pendingEmail: null, pendingProfile: null });
          return 'signed_in';
        }
        await auth.sendEmailCode(email);
        set({ pendingEmail: email, pendingProfile: { ...p, email } });
        return 'code_sent';
      },

      sendCode: async (email) => {
        const e = email.trim().toLowerCase();
        await auth.sendEmailCode(e);
        set((s) => ({ pendingEmail: e, pendingProfile: s.pendingProfile?.email === e ? s.pendingProfile : null }));
      },

      verifyCode: async (code) => {
        const { pendingEmail, pendingProfile } = get();
        if (!pendingEmail) throw new ApiError('code_invalid', 'no pending email');
        const session = await auth.verifyEmailCode(pendingEmail, code);
        const email = session.user.email ?? pendingEmail;
        // New student: save what they typed on Register. Returning student: load what's on file.
        const profile = pendingProfile ? await saveRemote(pendingProfile) : await api.getMyProfile();
        if (!profile) return 'needs_profile'; // signed in, but never registered
        set({ user: toUser(profile, email, get().user), pendingEmail: null, pendingProfile: null });
        return 'signed_in';
      },

      setRole: (role) => set((s) => (s.user ? { user: { ...s.user, role } } : {})),
      setOnline: (online) => set((s) => (s.user ? { user: { ...s.user, online } } : {})),
      setUpi: (upi) => set((s) => (s.user ? { user: { ...s.user, upi: upi.trim() || undefined } } : {})),
      saveUpi: async () => {
        const u = get().user;
        if (!u) return;
        try {
          const saved = await api.saveProfile({ regNo: u.regNo, name: u.name, phone: u.phone ?? '', block: u.block ?? '', upi: u.upi });
          set((s) => (s.user?.id === saved.id ? { user: { ...s.user, upi: saved.upi } } : {}));
        } catch (e) {
          // not a valid UPI id (or offline): show what the server has
          console.warn('saveUpi', e);
          const fresh = await api.getMyProfile().catch(() => null);
          if (fresh) set((s) => (s.user?.id === fresh.id ? { user: { ...s.user, upi: fresh.upi } } : {}));
        }
      },
      signOut: async () => {
        set({ user: null, pendingEmail: null, pendingProfile: null });
        await auth.signOut().catch((e) => console.warn('signOut', e));
      },
    }),
    {
      // v2: the old reg-number "sessions" are not valid against the new backend
      name: 'onmyway.auth.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user }),
    },
  ),
);

/**
 * Keep the stored user in step with the real Supabase session: signed out elsewhere, token
 * revoked, or a different account on this phone -> back to the sign-in screens. Call once.
 */
export function startAuthWatch(): () => void {
  const check = (sessionUserId: string | undefined) => {
    const u = useAuth.getState().user;
    if (u && u.id !== sessionUserId) useAuth.setState({ user: null });
  };
  auth.getSession().then((s) => check(s?.user.id));
  return auth.onAuthChange((s) => check(s?.user.id));
}
