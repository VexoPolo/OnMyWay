-- OnMyWay · end-to-end check of RLS + functions. Safe to run on the live project:
-- everything happens inside one DO block that ends by RAISING, so every row it creates
-- (fake auth users included) is rolled back. The report is the error message.
--
-- Users: A = customer, B and C = couriers, D = signed in but no profile.
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  d uuid := gen_random_uuid();
  g uuid := gen_random_uuid();
  out  text := '';
  err  text;
  res  text;
  n    int;
  ok   boolean;
  o1   public.orders;
  o2   public.orders;
  ids  uuid[] := '{}';
  x    uuid;
  pin  text;
  rec  record;
  pass int := 0;
  fail int := 0;
begin
  -- helper pattern:  as user  -> perform set_config('role','authenticated',true), set_config('request.jwt.claims', ..., true)
  --                  as admin -> perform set_config('role','postgres',true)

  ---------------------------------------------------------------- sign-up gate
  begin
    insert into auth.users (id, email, aud, role) values (g, 'someone@gmail.com', 'authenticated', 'authenticated');
    err := 'inserted';
  exception when others then err := sqlerrm; end;
  ok := err like '%not allowed%';
  out := out || format(E'%s  01 outside email (gmail) rejected at sign-up: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  -- postgres may not SET ROLE supabase_auth_admin, so prove the gate is a live trigger instead
  -- (triggers fire for every inserting role, the Auth service included).
  select tgenabled into err from pg_trigger where tgname = 'omw_gate_email' and tgrelid = 'auth.users'::regclass;
  ok := err = 'O';
  out := out || format(E'%s  02 sign-up gate is an enabled trigger on auth.users (fires for the Auth service too): %s\n', case when ok then 'PASS' else 'FAIL' end, coalesce(err, 'missing'));

  insert into auth.users (id, email, aud, role) values
    (a, 'test.a@vitstudent.ac.in', 'authenticated', 'authenticated'),
    (b, 'test.b@vitstudent.ac.in', 'authenticated', 'authenticated'),
    (c, 'test.c@vitstudent.ac.in', 'authenticated', 'authenticated'),
    (d, 'test.d@vitstudent.ac.in', 'authenticated', 'authenticated');
  out := out || E'PASS  03 four @vitstudent.ac.in sign-ups accepted\n';

  ---------------------------------------------------------------- config is the switch
  update public.app_config set value = '["vitstudent.ac.in","gmail.com"]' where key = 'allowed_email_domains';
  begin
    insert into auth.users (id, email, aud, role) values (g, 'someone@gmail.com', 'authenticated', 'authenticated');
    err := 'inserted';
  exception when others then err := sqlerrm; end;
  ok := err = 'inserted';
  out := out || format(E'%s  04 gmail allowed after adding it to app_config: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  update public.app_config set value = '["vitstudent.ac.in"]' where key = 'allowed_email_domains';

  -- the gmail account now exists; with the list restored it must be refused on every call
  begin
    perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
    perform public.save_profile('22BCE9990', 'Gmail Person', '9876500000', 'A');
    err := 'saved';
  exception when others then err := sqlerrm; end;
  perform set_config('role', 'postgres', true);
  ok := err = 'email_not_allowed';
  out := out || format(E'%s  05 existing gmail account refused once the list is restored: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  ---------------------------------------------------------------- anon gets nothing
  perform set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform 1 from public.orders limit 1; err := 'read ok'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  06 anon cannot read orders: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'anon', true);
  begin perform 1 from public.profiles limit 1; err := 'read ok'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  07 anon cannot read profiles: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'anon', true);
  begin perform public.quote_fare('M'); err := 'called'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  08 anon cannot call functions: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'postgres', true);

  ---------------------------------------------------------------- profiles
  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.save_profile('22BCE0001', 'Asha Customer', '+91 98765 00001', 'MH-A', 'asha@okaxis');
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.save_profile('22BCE0002', 'Bala Courier', '9876500002', 'MH-B', 'bala@okhdfc');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.save_profile('22BCE0003', 'Chitra Courier', '9876500003', 'LH-C');
  out := out || E'PASS  09 three profiles saved via save_profile (phone +91 normalised)\n';

  begin perform public.save_profile('22BCE0001', 'Chitra Courier', '9876500003', 'LH-C'); err := 'saved';
  exception when others then err := sqlerrm; end;
  ok := err = 'reg_no_locked' or err = 'reg_no_taken';
  out := out || format(E'%s  10 cannot take another student''s reg number: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin perform public.save_profile('22BCE7777', 'Asha Customer', '9876500001', 'MH-A'); err := 'saved';
  exception when others then err := sqlerrm; end;
  ok := err = 'reg_no_locked';
  out := out || format(E'%s  11 reg number locked after first save: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.profiles;
  ok := n = 1;
  out := out || format(E'%s  12 a student sees only their own profile row: %s row(s)\n', case when ok then 'PASS' else 'FAIL' end, n);

  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  begin perform public.place_order('Main Gate', null, 'M', 'MH-D'); err := 'placed';
  exception when others then err := sqlerrm; end;
  ok := err = 'profile_required';
  out := out || format(E'%s  13 no profile -> cannot place orders: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  ---------------------------------------------------------------- place: server-set fare
  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  o1 := public.place_order('Amazon Pick Up Point', 'TBA123456789', 'M', '', 'Leave at the desk', '4821', '+91 90000 11111');
  o2 := public.place_order('Main Gate', null, 'XL', 'MH-A');
  ok := o1.fare = 20 and o2.fare = 30 and o1.platform = 'Amazon' and o1.drop_block = 'MH-A' and o2.tracking_id like 'OMW-%';
  out := out || format(E'%s  14 fares set by server (M=%s, XL=%s), platform=%s, block defaulted, gate ref %s\n',
                       case when ok then 'PASS' else 'FAIL' end, o1.fare, o2.fare, o1.platform, o2.tracking_id);

  begin update public.orders set fare = 0 where id = o1.id; err := 'updated'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  15 direct UPDATE on orders refused (fare tamper): %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'authenticated', true);
  begin insert into public.orders (customer_id, pickup_point, tracking_id, platform, size, drop_block, fare)
        values (a, 'Main Gate', 'FAKE1', 'Courier', 'S', 'X', 1); err := 'inserted';
  exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  16 direct INSERT on orders refused: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'authenticated', true);
  begin perform 1 from public.order_secrets limit 1; err := 'read ok'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  17 order_secrets not readable, even by the order''s own customer: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'authenticated', true);
  begin perform 1 from public.app_config limit 1; err := 'read ok'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  18 app_config not readable by students: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  ---------------------------------------------------------------- accept
  perform set_config('role', 'authenticated', true);
  res := public.accept_order(o1.id);
  ok := res = 'own';
  out := out || format(E'%s  19 customer cannot accept own order: %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.orders where id in (o1.id, o2.id);
  ok := n = 2;
  out := out || format(E'%s  20 courier sees the open pool: %s of 2\n', case when ok then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.get_order_private(o1.id);
  ok := n = 0;
  out := out || format(E'%s  21 courier gets no private details before accepting: %s row(s)\n', case when ok then 'PASS' else 'FAIL' end, n);

  res := public.accept_order(o1.id);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  err := public.accept_order(o1.id);
  ok := res = 'ok' and err = 'taken';
  out := out || format(E'%s  22 first tap wins: B=%s, C=%s\n', case when ok then 'PASS' else 'FAIL' end, res, err);

  select count(*) into n from public.orders where id = o1.id;
  ok := n = 0;
  out := out || format(E'%s  23 losing courier can no longer see the taken order: %s row(s)\n', case when ok then 'PASS' else 'FAIL' end, n);
  select count(*) into n from public.get_order_private(o1.id);
  ok := n = 0;
  out := out || format(E'%s  24 ...nor its private details: %s row(s)\n', case when ok then 'PASS' else 'FAIL' end, n);

  ---------------------------------------------------------------- courier flow + PIN
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select * into rec from public.get_order_private(o1.id);
  ok := rec.my_role = 'courier' and rec.pickup_otp = '4821' and rec.driver_phone = '919000011111'
        and rec.other_name = 'Asha Customer' and rec.other_phone = '9876500001' and rec.delivery_pin is null and rec.other_upi is null;
  out := out || format(E'%s  25 courier private view: role=%s otp=%s driver=%s customer=%s/%s pin=%s\n',
                       case when ok then 'PASS' else 'FAIL' end, rec.my_role, rec.pickup_otp, rec.driver_phone,
                       rec.other_name, rec.other_phone, coalesce(rec.delivery_pin, 'hidden'));

  ok := not public.advance_order(o1.id, 'on_the_way');
  out := out || format(E'%s  26 cannot skip a step (allocated -> on_the_way)\n', case when ok then 'PASS' else 'FAIL' end);
  ok := public.advance_order(o1.id, 'picked_up') and public.advance_order(o1.id, 'on_the_way') and public.arrive_order(o1.id);
  out := out || format(E'%s  27 picked_up -> on_the_way -> reached\n', case when ok then 'PASS' else 'FAIL' end);
  select * into rec from public.get_order_private(o1.id);
  ok := rec.delivery_pin is null;
  out := out || format(E'%s  28 courier still cannot see the PIN after arriving: %s\n', case when ok then 'PASS' else 'FAIL' end, coalesce(rec.delivery_pin, 'hidden'));

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select * into rec from public.get_order_private(o1.id);
  pin := rec.delivery_pin;
  ok := pin ~ '^[0-9]{4}$' and rec.other_name = 'Bala Courier' and rec.other_upi = 'bala@okhdfc';
  out := out || format(E'%s  29 customer sees a 4-digit PIN + courier %s / %s\n', case when ok then 'PASS' else 'FAIL' end, rec.other_name, rec.other_upi);

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin res := public.verify_handover(o1.id, pin); exception when others then res := sqlerrm; end;
  ok := res = 'not_allowed';
  out := out || format(E'%s  30 another courier cannot verify (even with the right PIN): %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  res := '';
  for i in 1..5 loop
    res := res || public.verify_handover(o1.id, case when pin = '0000' then '1111' else '0000' end) || ' ';
  end loop;
  res := res || '| right PIN now: ' || public.verify_handover(o1.id, pin);
  ok := res = 'wrong wrong wrong wrong locked | right PIN now: locked';
  out := out || format(E'%s  31 5 wrong guesses lock the handover: %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := public.refresh_pin(o1.id);
  select * into rec from public.get_order_private(o1.id);
  pin := rec.delivery_pin;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  res := public.verify_handover(o1.id, pin);
  ok := ok and res = 'ok';
  out := out || format(E'%s  32 customer refreshes the PIN, courier verifies: %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  ok := public.complete_order(o1.id);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := ok and public.rate_order(o1.id, 5) and not public.rate_order(o1.id, 1);
  select status into res from public.orders where id = o1.id;
  ok := ok and res = 'delivered';
  out := out || format(E'%s  33 slide-to-complete -> %s, rated once (second rating refused)\n', case when ok then 'PASS' else 'FAIL' end, res);

  ---------------------------------------------------------------- audit log
  select string_agg(event, ' > ' order by id) into res from public.order_events where order_id = o1.id;
  ok := res = 'placed > accepted > picked_up > on_the_way > arrived > pin_wrong > pin_wrong > pin_wrong > pin_wrong > pin_wrong > pin_locked > pin_refreshed > handed_over > delivered > rated';
  out := out || format(E'%s  34 order_events (read as the customer): %s\n', case when ok then 'PASS' else 'FAIL' end, res);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.order_events where order_id = o1.id;
  ok := n = 0;
  out := out || format(E'%s  35 outsider sees none of that history: %s row(s)\n', case when ok then 'PASS' else 'FAIL' end, n);
  perform set_config('role', 'postgres', true);
  begin update public.order_events set event = 'x' where order_id = o1.id; err := 'updated'; exception when others then err := sqlerrm; end;
  ok := err like '%append-only%';
  out := out || format(E'%s  36 order_events is append-only even for the database owner: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  ---------------------------------------------------------------- caps
  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  for i in 1..4 loop
    ids := ids || (public.place_order('Main Gate', null, 'S', 'MH-A')).id;
  end loop;                                                    -- A now has 5 open (o2 + 4)
  begin perform public.place_order('Main Gate', null, 'S', 'MH-A'); err := 'placed'; exception when others then err := sqlerrm; end;
  ok := err = 'too_many_open_orders';
  out := out || format(E'%s  37 6th open order refused: %s\n', case when ok then 'PASS' else 'FAIL' end, err);

  perform set_config('role', 'authenticated', true), set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  res := '';
  foreach x in array ids loop res := res || public.accept_order(x) || ' '; end loop;
  res := res || public.accept_order(o2.id);
  ok := res = 'ok ok ok ok limit';
  out := out || format(E'%s  38 courier batch capped at 4: %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  ---------------------------------------------------------------- reports / cancel
  ok := public.report_order(ids[1], 'Parcel not ready', 'Gate said tomorrow');
  select status, courier_id into rec from public.orders where id = ids[1];   -- still visible: it is back in the open pool
  ok := ok and rec.status = 'available' and rec.courier_id is null;
  out := out || format(E'%s  39 courier report puts the order back in the pool: %s\n', case when ok then 'PASS' else 'FAIL' end, rec.status);

  ok := public.advance_order(ids[2], 'picked_up');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  ok := ok and not public.cancel_order(ids[2]) and public.cancel_order(ids[3]);
  out := out || format(E'%s  40 customer can cancel before pickup, not after\n', case when ok then 'PASS' else 'FAIL' end);

  ok := public.report_order(ids[2], 'Courier not responding');
  select status into res from public.orders where id = ids[2];
  ok := ok and res = 'disputed';
  out := out || format(E'%s  41 customer report marks the order %s\n', case when ok then 'PASS' else 'FAIL' end, res);

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  ok := not public.report_order(ids[4], 'spam');
  out := out || format(E'%s  42 outsider cannot report someone else''s order\n', case when ok then 'PASS' else 'FAIL' end);

  ---------------------------------------------------------------- housekeeping
  perform set_config('role', 'authenticated', true);
  begin perform public.release_stale_orders(); err := 'called'; exception when others then err := sqlerrm; end;
  ok := err like 'permission denied%';
  out := out || format(E'%s  43 students cannot run release_stale_orders: %s\n', case when ok then 'PASS' else 'FAIL' end, err);
  perform set_config('role', 'postgres', true);

  select count(*) into n from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders';
  ok := n = 1;
  out := out || format(E'%s  44 orders is on the realtime publication\n', case when ok then 'PASS' else 'FAIL' end);

  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  ok := n = 0;
  out := out || format(E'%s  45 RLS on every public table (%s without)\n', case when ok then 'PASS' else 'FAIL' end, n);

  pass := (length(out) - length(replace(out, 'PASS  ', ''))) / 6;
  fail := (length(out) - length(replace(out, 'FAIL  ', ''))) / 6;
  raise exception E'OMW TEST REPORT (rolled back) — % passed, % failed\n%', pass, fail, out;
end
$test$;
