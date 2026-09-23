-- Home-Products: one shared document per apartment, addressed by a secret code.
-- The table is closed to direct API access (RLS on, no policies); clients go
-- through the security-definer functions below, which match on sha256(code).

create table if not exists public.hp_homes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hp_homes enable row level security;
revoke all on public.hp_homes from anon, authenticated;

create or replace function public.hp_code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_code, 'UTF8')), 'hex')
$$;

create or replace function public.hp_create_home(p_code text, p_data jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code is null or pg_catalog.length(p_code) < 12 then
    raise exception 'code_too_short';
  end if;
  if pg_catalog.pg_column_size(p_data) > 2000000 then
    raise exception 'data_too_large';
  end if;
  insert into public.hp_homes (code_hash, data)
  values (public.hp_code_hash(p_code), coalesce(p_data, '{}'::jsonb));
  return 1;
exception
  when unique_violation then
    raise exception 'code_taken';
end;
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
  where h.code_hash = public.hp_code_hash(p_code)
$$;

-- Returns the new version, or -1 when p_expected_version is stale.
create or replace function public.hp_save_home(p_code text, p_data jsonb, p_expected_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := public.hp_code_hash(p_code);
  v_version integer;
begin
  if pg_catalog.pg_column_size(p_data) > 2000000 then
    raise exception 'data_too_large';
  end if;
  update public.hp_homes h
     set data = p_data,
         version = h.version + 1,
         updated_at = pg_catalog.now()
   where h.code_hash = v_hash
     and h.version = p_expected_version
  returning h.version into v_version;

  if v_version is not null then
    return v_version;
  end if;
  if exists (select 1 from public.hp_homes h where h.code_hash = v_hash) then
    return -1;
  end if;
  raise exception 'not_found';
end;
$$;

revoke all on function public.hp_code_hash(text) from public, anon, authenticated;
revoke all on function public.hp_create_home(text, jsonb) from public;
revoke all on function public.hp_load_home(text) from public;
revoke all on function public.hp_save_home(text, jsonb, integer) from public;
grant execute on function public.hp_create_home(text, jsonb) to anon, authenticated;
grant execute on function public.hp_load_home(text) to anon, authenticated;
grant execute on function public.hp_save_home(text, jsonb, integer) to anon, authenticated;
