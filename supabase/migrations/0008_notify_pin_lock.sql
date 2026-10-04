-- OnMyWay · 0008 · tell the customer's phone when the handover PIN locks.
-- Wrong guesses only touch order_secrets, which nobody can subscribe to, so the customer never
-- learned the code was locked. Bumping orders.updated_at on lock makes realtime deliver the row,
-- the app refetches get_order_private (pin_attempts_left = 0) and offers a fresh code.
create or replace function public.verify_handover(p_order uuid, p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.member();
  s   public.order_secrets;
begin
  perform 1 from public.orders x
   where x.id = p_order and x.courier_id = uid and x.status = 'reached'
     for update;
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into s from public.order_secrets y where y.order_id = p_order for update;

  if s.pin_attempts >= private.pin_max_attempts() then return 'locked'; end if;
  if s.pin_expiry is null or now() > s.pin_expiry then return 'expired'; end if;
  if s.delivery_pin is distinct from trim(coalesce(p_code, '')) then
    update public.order_secrets y set pin_attempts = y.pin_attempts + 1 where y.order_id = p_order;
    perform private.log(p_order, uid, 'pin_wrong', 'reached', 'reached',
                        jsonb_build_object('attempt', s.pin_attempts + 1));
    if s.pin_attempts + 1 >= private.pin_max_attempts() then
      update public.orders x set updated_at = now() where x.id = p_order;   -- wakes the customer's screen
      perform private.log(p_order, uid, 'pin_locked', 'reached', 'reached');
      return 'locked';
    end if;
    return 'wrong';
  end if;

  update public.orders x set status = 'handed_over', handed_over_at = now() where x.id = p_order;
  update public.order_secrets y set delivery_pin = null where y.order_id = p_order;
  perform private.log(p_order, uid, 'handed_over', 'reached', 'handed_over');
  return 'ok';
end $$;
