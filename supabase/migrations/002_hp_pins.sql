-- Home-Products: extra codes per apartment and a short personal PIN.
--
-- hp_home_codes lets an apartment answer to more than one long code (an alias).
-- hp_pins maps a 4-digit PIN to one of those codes, so the owner can sign in with
-- the PIN and the app carries on with the long code as before. PINs are provisioned
-- by the database owner only; there is no public RPC to set or probe one.
--
-- A 4-digit PIN has 10,000 values, so failed PIN logins are throttled globally:
-- at most 10 failures per 15 minutes and 60 per day. Guessing one PIN then takes
-- months, while the long code keeps working for everyone during a lockout.
-- (hp_pin_failures stays tiny: the throttle caps it at about 60 rows a day.)

create table if not exists public.hp_home_codes (
  code_hash text primary key,
  home_id uuid not null references public.hp_homes (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.hp_pins (
  pin_hash text primary key,
  home_id uuid not null references public.hp_homes (id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hp_pin_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
create index if not exists hp_pin_failures_at on public.hp_pin_failures (at);
create index if not exists hp_home_codes_home on public.hp_home_codes (home_id);
create index if not exists hp_pins_home on public.hp_pins (home_id);

alter table public.hp_home_codes enable row level security;
alter table public.hp_pins enable row level security;
alter table public.hp_pin_failures enable row level security;
revoke all on public.hp_home_codes from anon, authenticated;
revoke all on public.hp_pins from anon, authenticated;
revoke all on public.hp_pin_failures from anon, authenticated;

-- The apartment a long code (primary or alias) opens, or null.
create or replace function public.hp_home_id(p_code text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select h.id from public.hp_homes h where h.code_hash = public.hp_code_hash(p_code)),
    (select c.home_id from public.hp_home_codes c where c.code_hash = public.hp_code_hash(p_code))
  )
$$;

create or replace function public.hp_load_home(p_code text)
returns table (data jsonb, version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.data, h.version
  from public.hp_homes h
  where h.id = public.hp_home_id(p_code)
$$;

-- Returns the new version, or -1 when p_expected_version is stale.
create or replace function public.hp_save_home(p_code text, p_data jsonb, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.hp_home_id(p_code);
  v_version integer;
begin
  if pg_catalog.pg_column_size(p_data) > 2000000 then
    raise exception 'data_too_large';
  end if;
  if v_id is null then
    raise exception 'not_found';
  end if;
  update public.hp_homes h
     set data = p_data,
         version = h.version + 1,
         updated_at = pg_catalog.now()
   where h.id = v_id
     and h.version = p_expected_version
  returning h.version into v_version;
  return coalesce(v_version, -1);
end;
$$;

-- Trades a PIN for its long code; null when the PIN is unknown.
-- Raises 'pin_locked' while too many recent attempts have failed.
create or replace function public.hp_pin_login(p_pin text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin';
  end if;
  -- One attempt at a time, so parallel requests cannot slip past the throttle.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('hp_pin_login'));
  if (select count(*) from public.hp_pin_failures f where f.at > pg_catalog.now() - interval '15 minutes') >= 10
     or (select count(*) from public.hp_pin_failures f where f.at > pg_catalog.now() - interval '24 hours') >= 60 then
    raise exception 'pin_locked';
  end if;
  select p.code into v_code from public.hp_pins p where p.pin_hash = public.hp_code_hash('hp-pin:' || p_pin);
  if v_code is null then
    insert into public.hp_pin_failures default values;
  end if;
  return v_code;
end;
$$;

revoke all on function public.hp_home_id(text) from public, anon, authenticated;
revoke all on function public.hp_load_home(text) from public;
revoke all on function public.hp_save_home(text, jsonb, integer) from public;
revoke all on function public.hp_pin_login(text) from public;
grant execute on function public.hp_load_home(text) to anon, authenticated;
grant execute on function public.hp_save_home(text, jsonb, integer) to anon, authenticated;
grant execute on function public.hp_pin_login(text) to anon, authenticated;
