-- OnMyWay · 0001 · config, profiles, sign-up gate.
-- Identity is always auth.uid(). Nothing here depends on HOW the user signed in (email code,
-- Google, Microsoft…): the only thing we look at is the verified email on auth.users.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 1. config ----------------------------------------------------------------------------------
-- Admin-only knobs, edited from the dashboard SQL editor. No client can read or write this table.
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  note       text,
  updated_at timestamptz not null default now()
);

-- Loosen for testing:   update public.app_config set value = '["vitstudent.ac.in","gmail.com"]' where key = 'allowed_email_domains';
-- Anyone at all:        update public.app_config set value = '["*"]' where key = 'allowed_email_domains';
-- Restore before demo:  update public.app_config set value = '["vitstudent.ac.in"]' where key = 'allowed_email_domains';
insert into public.app_config (key, value, note) values
  ('allowed_email_domains', '["vitstudent.ac.in"]',
   'Email domains that may sign up and use the app. ["*"] allows any (testing only). Restore to ["vitstudent.ac.in"] before the demo.');

-- 2. helpers ---------------------------------------------------------------------------------
create function private.email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_email, '') ~ '^[^@\s]+@[^@\s]+$'
     and exists (
       select 1
         from jsonb_array_elements_text(
                coalesce((select c.value from public.app_config c where c.key = 'allowed_email_domains'), '[]'::jsonb)) d
        where d = '*'
           or lower(substring(p_email from '@([^@]+)$')) = lower(ltrim(trim(d), '@'))
     )
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- 3. sign-up gate ----------------------------------------------------------------------------
-- Runs for every way an account can be created (email code, OAuth, dashboard invite) and on
-- email change. Accounts that already exist are not touched; the per-call check in
-- private.me() covers them if the allowed list is tightened later.
create function private.gate_auth_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not private.email_allowed(new.email) then
    raise exception 'This email domain is not allowed on OnMyWay' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger omw_gate_email
  before insert or update of email on auth.users
  for each row execute function private.gate_auth_email();

-- 4. profiles --------------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  reg_no       text not null unique check (reg_no ~ '^[0-9]{2}[A-Z]{3}[0-9]{4}$'),
  full_name    text not null check (char_length(full_name) between 2 and 80),
  phone        text not null check (phone ~ '^[0-9]{10}$'),
  hostel_block text not null check (char_length(hostel_block) between 1 and 40),
  upi_vpa      text check (upi_vpa is null or upi_vpa ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger omw_profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
