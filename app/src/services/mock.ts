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

  /** Simulates the broadcast: after a delay, a courier somewhere accepts. */
  async findCourier(): Promise<{ regNo: string; name: string; etaMin: number }> {
    await wait(2500 + Math.random() * 2000);
    return { regNo: '22BCE0419', name: 'Aarav', etaMin: 8 };
  },
};

export const CAMPUS_PLACES = [
  'Main Gate',
  'Block A',
  'Block B',
  'Block C',
  'Library',
  'Mens Hostel',
  'Ladies Hostel',
  'Food Court',
  'Sports Complex',
] as const;

/** Crude distance table in km — keyed by index difference. Good enough for a fare quote. */
export function estimateKm(from: string, to: string): number {
  const a = CAMPUS_PLACES.indexOf(from as any);
  const b = CAMPUS_PLACES.indexOf(to as any);
  if (a < 0 || b < 0 || a === b) return 0.4;
  return Math.round((0.5 + Math.abs(a - b) * 0.35) * 10) / 10;
}
