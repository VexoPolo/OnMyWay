import { useEffect } from 'react';
import { useOrders } from '../store/orders';

export const MOCK_COURIER = '22BCE0419';

/**
 * When the mock courier holds the order (nobody on this device accepted it),
 * walk it through the states on a timer so a single-phone demo still plays
 * end to end. A real courier on the same device short-circuits all of this.
 */
export function useMockCourier(orderId: string) {
  const order = useOrders((s) => s.orders[orderId]);
  const advance = useOrders((s) => s.advance);
  const arrive = useOrders((s) => s.arrive);
  const confirm = useOrders((s) => s.confirmHandover);

  useEffect(() => {
    if (!order || order.courierRegNo !== MOCK_COURIER) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    switch (order.state) {
      case 'AGENT_ASSIGNED':
        t = setTimeout(() => advance(orderId), 3000); // → PICKED_UP
        break;
      case 'PICKED_UP':
        t = setTimeout(() => advance(orderId), 3000); // → OUT_FOR_DELIVERY
        break;
      case 'OUT_FOR_DELIVERY':
        t = setTimeout(() => arrive(orderId), 5000); // → ARRIVED (+ OTP)
        break;
      case 'ARRIVED':
        // The customer reads the code out; the mock courier "types" it after a beat.
        t = setTimeout(() => order.otp && confirm(orderId, order.otp.code), 6000);
        break;
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [order?.state, order?.courierRegNo, orderId, advance, arrive, confirm, order]);
}
