/**
 * Sign-in stand-in. Orders and profiles are live in Supabase (see store/orders.ts, store/auth.ts).
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  /** Reg number + password. No server yet — shape check only, so the loading state is real. */
  async signIn(regNo: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    await wait(700);
    if (regNo.trim().length < 5) return { ok: false, error: 'That does not look like a registration number.' };
    if (password.length < 4) return { ok: false, error: 'Password is too short.' };
    return { ok: true };
  },
};

export const PICKUP_POINTS = ['Main Gate', 'Amazon Pick Up Point'] as const;
export type PickupPoint = (typeof PICKUP_POINTS)[number];

/** Rough walk from a pickup point to a hostel block, in km. Good enough for the demo. */
export function estimateKm(from: string, to: string): number {
  const base = from === 'Amazon Pick Up Point' ? 0.8 : 1.4;
  const ladies = to.startsWith('LH');
  return Math.round((base + (ladies ? 0.4 : 0)) * 10) / 10;
}
