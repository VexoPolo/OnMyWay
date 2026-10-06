import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/backend/api';
import * as auth from '../services/backend/auth';
import { ApiError, toApiError } from '../services/backend/errors';
import type { Profile, Role, User } from './types';

/** What the code screen does next once the code checks out. */
export type VerifyOutcome = 'signed_in' | 'needs_profile' | 'needs_id_card';

interface AuthState {
  /** Set once there is a session AND a saved profile. The navigator keys off this. */
  user: User | null;
  /** Between "send code" and the code screen. */
  pendingEmail: string | null;
  /** From registration; saved to the server right after the code is verified. */
  pendingProfile: Profile | null;
  /** Signed in with a profile but no ID card on file (signed up before the ID step). Not persisted. */
  pendingIdUser: User | null;
  /** Register: emails a code, or saves straight away if this email is already signed in. */
  register: (p: Profile) => Promise<'code_sent' | 'signed_in'>;
  /** Sign in: emails a code. */
  sendCode: (email: string) => Promise<void>;
  /** The code screen. Throws ApiError (code_invalid, reg_no_taken, ...). */
  verifyCode: (code: string) => Promise<VerifyOutcome>;
  /** After 'needs_id_card': upload the photo (or skip with none) and go into the app. */
  finishIdCard: (card?: Profile['idCard']) => Promise<void>;
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

/** Runs only once signed in, so its failures are never about the code: they get their own codes. */
async function saveRemote(p: Profile) {
  const saved = await api.saveProfile({ regNo: p.regNo.trim().toUpperCase(), name: p.name, phone: p.phone, block: p.block, upi: p.upi }).catch((e) => {
    const err = toApiError(e);
    // reg_no_taken, invalid_profile, offline... keep their own copy; anything vague gets the save message
    throw err.code === 'unknown' || err.code === 'code_invalid' ? new ApiError('profile_save_failed', err.message) : err;
  });
  // After the save, so the profile exists when the photo lands (the upload sets id_status to
  // pending) and the check has a profile to compare with. A retry re-saves the same details.
  if (p.idCard) {
    await api.uploadIdCard(p.idCard.uri).catch((e) => {
      throw new ApiError('id_upload_failed', toApiError(e).message);
    });
    checkIdCard();
  }
  return saved;
}

/** Ask for an ID card when the server has none on file or rejected it; not while one is pending,
 * approved or in review. Before migration 0012 there is no id_status: fall back to the file. */
async function needsIdCard(profile: api.Profile): Promise<boolean> {
  if (profile.idStatus) return profile.idStatus === 'none' || profile.idStatus === 'rejected';
  return !(await api.hasIdCard());
}

/** Start the server's ID check. Never blocks sign-in; a failed call leaves the photo for later. */
function checkIdCard() {
  api.verifyIdCard().catch((e) => console.warn('verifyIdCard', toApiError(e).code));
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      pendingEmail: null,
      pendingProfile: null,
      pendingIdUser: null,

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
        // a retry after a failed save: the code was already used, the session is what counts
        const current = await auth.getSession();
        const session =
          current?.user.email?.toLowerCase() === pendingEmail ? current : await auth.verifyEmailCode(pendingEmail, code);
        const email = session.user.email ?? pendingEmail;
        // New student: save what they typed on Register. Returning student: load what's on file.
        const profile = pendingProfile ? await saveRemote(pendingProfile) : await api.getMyProfile();
        if (!profile) return 'needs_profile'; // signed in, but never registered
        const user = toUser(profile, email, get().user);
        // returning student who signed up before the ID step: ask once per sign-in, never block
        if (!pendingProfile && (await needsIdCard(profile))) {
          set({ pendingIdUser: user, pendingEmail: null, pendingProfile: null });
          return 'needs_id_card';
        }
        set({ user, pendingEmail: null, pendingProfile: null });
        return 'signed_in';
      },

      finishIdCard: async (card) => {
        if (card) {
          await api.uploadIdCard(card.uri).catch((e) => {
            throw new ApiError('id_upload_failed', toApiError(e).message);
          });
          checkIdCard();
        }
        set((s) => ({ user: s.pendingIdUser, pendingIdUser: null }));
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
        set({ user: null, pendingEmail: null, pendingProfile: null, pendingIdUser: null });
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
    // same as the Sign out button; orders.ts clears the cached orders when user goes null
    if (u && u.id !== sessionUserId) useAuth.setState({ user: null, pendingEmail: null, pendingProfile: null, pendingIdUser: null });
  };
  auth.getSession().then((s) => check(s?.user.id));
  return auth.onAuthChange((s) => check(s?.user.id));
}
