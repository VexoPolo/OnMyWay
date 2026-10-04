-- OnMyWay · 0009 · the drop-off is always the customer's own hostel block.
-- 0003's place_order took p_drop_block and only fell back to the profile when it was blank, so a
-- modified client could send a parcel to any block. The parameter is gone: the server reads the
-- block from the caller's profile, like it already does for the fare.
drop function public.place_order(text, text, text, text, text, text, text);

create function public.place_order(p_pickup_point text, p_tracking_id text, p_size text,
                                   p_note text default '', p_pickup_otp text default null,
                                   p_driver_phone text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  uid   uuid := private.member();
  tid   text := nullif(upper(regexp_replace(coalesce(p_tracking_id, ''), '\s', '', 'g')), '');
  blk   text;
  fare  int  := private.fare_for(p_size);
  o     public.orders;
begin
  if fare is null then raise exception 'invalid_size' using errcode = 'P0001'; end if;
  if (select count(*) from public.orders x
       where x.customer_id = uid
         and x.status in ('available', 'allocated', 'picked_up', 'on_the_way', 'reached', 'handed_over'))
     >= private.max_open_orders() then
    raise exception 'too_many_open_orders' using errcode = 'P0001',
      hint = format('You can have at most %s open orders.', private.max_open_orders());
  end if;
  if p_pickup_point = 'Amazon Pick Up Point' and tid is null then
    raise exception 'tracking_required' using errcode = 'P0001';
  end if;
  tid := coalesce(tid, 'OMW-' || private.random_digits(6));   -- gate pickups without a platform id
  select p.hostel_block into blk from public.profiles p where p.id = uid;   -- never from the client

  insert into public.orders (customer_id, pickup_point, tracking_id, platform, size, drop_block, note, fare)
  values (uid, p_pickup_point, tid, private.platform_of(tid), upper(p_size), blk, trim(coalesce(p_note, '')), fare)
  returning * into o;
  insert into public.order_secrets (order_id, pickup_otp, driver_phone)
  values (o.id, private.digits(p_pickup_otp), private.digits(p_driver_phone));
  perform private.log(o.id, uid, 'placed', null, 'available', jsonb_build_object('fare', fare, 'size', o.size));
  return o;
exception
  when check_violation then
    raise exception 'invalid_order' using errcode = 'P0001', hint = sqlerrm;
end $$;

revoke execute on function public.place_order(text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(text, text, text, text, text, text) to authenticated;
