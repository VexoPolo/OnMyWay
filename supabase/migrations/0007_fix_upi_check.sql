-- OnMyWay · 0007 · the UPI check in 0001 used {2,256}; Postgres caps regex repeats at 255,
-- so every profile save with a UPI id errored. UPI handles are short: cap at 64.
alter table public.profiles drop constraint profiles_upi_vpa_check;
alter table public.profiles add constraint profiles_upi_vpa_check
  check (upi_vpa is null or upi_vpa ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,63}$');
