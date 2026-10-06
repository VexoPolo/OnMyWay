-- OnMyWay · 0014 · barcode-only ID checks: auto-approve switch and the reviewer's decision.
-- verify-id now decodes the card's barcode and compares it with the typed reg number; no AI.
-- (id_allowed_institutions from 0012 is no longer read by anything.)

insert into public.app_config (key, value, note) values
  ('id_auto_approve_on_barcode', 'false',
   'true: a barcode that matches the typed reg number approves the ID at once. false: it goes to review (reason barcode_match).')
on conflict (key) do nothing;

-- A person's decision after looking at the photo in Storage -> id-cards.
-- Run from the SQL editor (as the owner) or by the service role; nobody else can call it.
-- Sets the photo to be deleted by the next purge. Returns false if that student isn't in
-- review or rejected (nothing to decide, or a new upload is being checked).
create function public.id_review_decide(p_user uuid, p_status text, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.profiles x
     set id_status = p_status, id_reason = p_reason, id_checked_at = now(), id_photo_delete_after = now()
   where x.id = p_user and x.id_status in ('review', 'rejected');
  return found;
end $$;

revoke execute on function public.id_review_decide(uuid, text, text) from public, anon, authenticated;
grant execute on function public.id_review_decide(uuid, text, text) to service_role;
