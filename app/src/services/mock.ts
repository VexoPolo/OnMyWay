export const PICKUP_POINTS = ['Main Gate', 'Amazon Pick Up Point'] as const;
export type PickupPoint = (typeof PICKUP_POINTS)[number];

/** Rough walk from a pickup point to a hostel block, in km. Good enough for the demo. */
export function estimateKm(from: string, to: string): number {
  const base = from === 'Amazon Pick Up Point' ? 0.8 : 1.4;
  const ladies = to.startsWith('LH');
  return Math.round((base + (ladies ? 0.4 : 0)) * 10) / 10;
}
