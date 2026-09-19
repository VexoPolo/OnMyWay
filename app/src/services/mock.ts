/**
 * Mock service layer. Same shape a real API client would have, so swapping in
 * fetch() calls later is a one-file change. Delays are there so the UI's
 * loading states are real.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const REG_RE = /^\d{2}[A-Z]{3}\d{4}$/i; // e.g. 22BCE1234 — VIT style; loosened below for the demo

export const api = {
  /** Reg number + password → server texts a 6-digit code. Demo code is always 123456. */
  async signIn(regNo: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    await wait(700);
    if (regNo.trim().length < 5) return { ok: false, error: 'That does not look like a registration number.' };
    if (password.length < 4) return { ok: false, error: 'Password is too short.' };
    return { ok: true };
  },

  async verifyOtp(regNo: string, code: string): Promise<{ ok: true; token: string; name: string } | { ok: false; error: string }> {
    await wait(600);
    if (code !== '123456') return { ok: false, error: 'Wrong code. Try 123456 in the demo.' };
    const name = regNo.toUpperCase().match(REG_RE) ? 'Student ' + regNo.slice(-4) : 'Student';
    return { ok: true, token: 'demo.' + Math.random().toString(36).slice(2), name };
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
