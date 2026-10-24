-- Anonymous visitors use the Edge Function, never direct database access.
create table if not exists public.data_submissions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  input_hash text not null,
  city text not null check (city in ('mashhad','tehran','other')),
  kind text not null check (kind in ('timetable','amenities','station','other')),
  station text not null default '',
  details text not null default '',
  photo_path text,
  contact_name text not null default '',
  contact_details text not null default '',
  status text not null default 'pending' check (status in ('pending','publishing','published')),
  issue_url text
);
alter table public.data_submissions enable row level security;
revoke all on public.data_submissions from anon, authenticated;
grant all on public.data_submissions to service_role;

create table if not exists public.data_intake_limits (
  key text primary key,
  period_start timestamptz not null,
  hits integer not null default 0
);
alter table public.data_intake_limits enable row level security;
revoke all on public.data_intake_limits from anon, authenticated;
grant all on public.data_intake_limits to service_role;

create or replace function public.reserve_data_intake(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  hour_start timestamptz := date_trunc('hour', now());
  day_start timestamptz := date_trunc('day', now());
  ip_hour text := p_key || ':h:' || hour_start::text;
  ip_day text := p_key || ':d:' || day_start::text;
  global_day text := 'global:d:' || day_start::text;
begin
  if p_key !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(17466806);
  delete from public.data_intake_limits where period_start < now() - interval '2 days';
  if coalesce((select hits from public.data_intake_limits where key=ip_hour),0) >= 4
    or coalesce((select hits from public.data_intake_limits where key=ip_day),0) >= 10
    or coalesce((select hits from public.data_intake_limits where key=global_day),0) >= 100
    then return false;
  end if;
  insert into public.data_intake_limits(key,period_start,hits) values
    (ip_hour,hour_start,1),(ip_day,day_start,1),(global_day,day_start,1)
    on conflict(key) do update set hits=data_intake_limits.hits+1;
  return true;
end $$;
revoke all on function public.reserve_data_intake(text) from public, anon, authenticated;
grant execute on function public.reserve_data_intake(text) to service_role;

-- Evidence is public because it is attached to a public issue. Contact stays
-- in the private table above; browsers have no upload/list permission here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('contribution-evidence','contribution-evidence',true,524288,array['image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=524288,allowed_mime_types=array['image/jpeg'];
