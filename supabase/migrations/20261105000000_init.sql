-- Yifan Logistics schema.
-- Apply with the Supabase CLI against a project where auth and storage already exist.
-- Public signup stays disabled. Roles are never taken from user metadata.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'customer' check (role in ('customer', 'sales', 'admin')),
  display_name text,
  company_name text,
  phone text,
  whatsapp text,
  locale text not null default 'en' check (locale in ('zh', 'en', 'fr')),
  -- GoTrue may mark an address confirmed so the account can sign in.
  -- This application still treats the address as an unverified identifier.
  email_ownership_verified boolean not null default false,
  tokens_valid_after timestamptz not null default timestamptz '1970-01-01+00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_unique unique (email),
  constraint profiles_email_len check (char_length(email) between 3 and 254)
);

create table public.revoked_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  revoked_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.protect_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(auth.role(), '');
begin
  if new.id is distinct from old.id then
    raise exception 'profile id is immutable';
  end if;
  if jwt_role is distinct from 'service_role' then
    if new.role is distinct from old.role then
      raise exception 'role change is not allowed';
    end if;
    if new.email is distinct from old.email then
      raise exception 'email change is not allowed';
    end if;
    if new.email_ownership_verified is distinct from old.email_ownership_verified then
      raise exception 'email ownership flag is not client writable';
    end if;
    if new.tokens_valid_after is distinct from old.tokens_valid_after then
      raise exception 'session revocation is not client writable';
    end if;
  end if;
  if new.email_ownership_verified and not old.email_ownership_verified and jwt_role is distinct from 'service_role' then
    raise exception 'email ownership cannot be self-asserted';
  end if;
  return new;
end;
$$;

create trigger profiles_protect
before update on public.profiles
for each row execute function public.protect_profile();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, locale, email_ownership_verified)
  values (new.id, lower(coalesce(new.email, '')), 'customer', 'en', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('sales', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table public.countries (
  code text primary key,
  name_zh text not null,
  name_en text not null,
  name_fr text not null
);

create table public.ports (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  country_code text not null references public.countries (code),
  name_zh text not null,
  name_en text not null,
  name_fr text not null,
  timezone text not null,
  kind text not null check (kind in ('origin', 'destination', 'both')),
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_zh text not null,
  name_en text not null,
  name_fr text not null,
  is_active boolean not null default true,
  visibility text not null default 'public' check (visibility in ('public', 'demo')),
  created_at timestamptz not null default now()
);

create table public.container_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_zh text not null,
  name_en text not null,
  name_fr text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin_port_id uuid not null references public.ports (id),
  destination_port_id uuid not null references public.ports (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (origin_port_id, destination_port_id),
  check (origin_port_id <> destination_port_id)
);

-- ---------------------------------------------------------------------------
-- Rates. Published commercial fields are immutable.
-- ---------------------------------------------------------------------------

create table public.freight_rate_versions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null,
  version_no int not null check (version_no > 0),
  route_id uuid not null references public.routes (id),
  carrier_id uuid not null references public.carriers (id),
  service_type text not null check (service_type in ('direct', 'transshipment')),
  transshipment_note_zh text,
  transshipment_note_en text,
  transshipment_note_fr text,
  transit_days_min int check (transit_days_min is null or transit_days_min >= 0),
  transit_days_max int check (transit_days_max is null or transit_days_max >= 0),
  transit_is_confirmed boolean not null default false,
  cutoff_at timestamptz,
  cutoff_is_confirmed boolean not null default false,
  etd_at timestamptz,
  etd_is_confirmed boolean not null default false,
  valid_from date not null,
  valid_to date not null,
  currency text not null,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'expired', 'superseded', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'demo')),
  notes_zh text,
  notes_en text,
  notes_fr text,
  internal_note text,
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, version_no),
  check (valid_to >= valid_from),
  check (transit_days_max is null or transit_days_min is null or transit_days_max >= transit_days_min),
  check (char_length(currency) = 3)
);

create table public.freight_rate_prices (
  id uuid primary key default gen_random_uuid(),
  rate_version_id uuid not null references public.freight_rate_versions (id) on delete cascade,
  container_type_id uuid not null references public.container_types (id),
  cost_amount numeric(14, 2) check (cost_amount is null or cost_amount >= 0),
  sell_amount numeric(14, 2) check (sell_amount is null or sell_amount >= 0),
  unique (rate_version_id, container_type_id)
);

create trigger freight_rate_versions_touch
before update on public.freight_rate_versions
for each row execute function public.touch_updated_at();

create or replace function public.protect_published_rate()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('published', 'expired', 'superseded', 'archived') then
    if new.series_id is distinct from old.series_id
      or new.version_no is distinct from old.version_no
      or new.route_id is distinct from old.route_id
      or new.carrier_id is distinct from old.carrier_id
      or new.service_type is distinct from old.service_type
      or new.transshipment_note_zh is distinct from old.transshipment_note_zh
      or new.transshipment_note_en is distinct from old.transshipment_note_en
      or new.transshipment_note_fr is distinct from old.transshipment_note_fr
      or new.transit_days_min is distinct from old.transit_days_min
      or new.transit_days_max is distinct from old.transit_days_max
      or new.transit_is_confirmed is distinct from old.transit_is_confirmed
      or new.cutoff_at is distinct from old.cutoff_at
      or new.cutoff_is_confirmed is distinct from old.cutoff_is_confirmed
      or new.etd_at is distinct from old.etd_at
      or new.etd_is_confirmed is distinct from old.etd_is_confirmed
      or new.valid_from is distinct from old.valid_from
      or new.valid_to is distinct from old.valid_to
      or new.currency is distinct from old.currency
      or new.visibility is distinct from old.visibility
      or new.notes_zh is distinct from old.notes_zh
      or new.notes_en is distinct from old.notes_en
      or new.notes_fr is distinct from old.notes_fr
      or new.internal_note is distinct from old.internal_note
      or new.published_at is distinct from old.published_at
      or new.published_by is distinct from old.published_by
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'published rate versions are immutable';
    end if;
  end if;

  if old.status = 'published' and new.status not in ('published', 'expired', 'superseded', 'archived') then
    raise exception 'invalid rate status transition';
  end if;
  if old.status in ('expired', 'superseded', 'archived') and new.status is distinct from old.status then
    raise exception 'final rate status cannot change';
  end if;
  if old.status = 'draft' and new.status not in ('draft', 'pending_review', 'published', 'archived') then
    raise exception 'invalid rate status transition';
  end if;
  if old.status = 'pending_review' and new.status not in ('pending_review', 'draft', 'published', 'archived') then
    raise exception 'invalid rate status transition';
  end if;
  return new;
end;
$$;

create trigger freight_rate_versions_protect
before update on public.freight_rate_versions
for each row execute function public.protect_published_rate();

create or replace function public.protect_rate_prices()
returns trigger
language plpgsql
as $$
declare
  parent_status text;
  parent_id uuid;
begin
  parent_id := coalesce(new.rate_version_id, old.rate_version_id);
  select status into parent_status from public.freight_rate_versions where id = parent_id;
  if parent_status in ('published', 'expired', 'superseded', 'archived') then
    raise exception 'prices of a published rate are immutable';
  end if;
  if tg_op = 'UPDATE' and new.rate_version_id is distinct from old.rate_version_id then
    raise exception 'price row cannot move between versions';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger freight_rate_prices_protect
before update or delete on public.freight_rate_prices
for each row execute function public.protect_rate_prices();

create index freight_rate_lookup_idx
  on public.freight_rate_versions (status, visibility, valid_from, valid_to);

-- ---------------------------------------------------------------------------
-- Local charges. Amounts are configuration, never hardcoded in the app.
-- ---------------------------------------------------------------------------

create table public.charge_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_zh text not null,
  name_en text not null,
  name_fr text not null,
  description_zh text,
  description_en text,
  description_fr text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.charge_rules (
  id uuid primary key default gen_random_uuid(),
  charge_item_id uuid not null references public.charge_items (id),
  pricing_mode text not null check (pricing_mode in ('fixed', 'manual', 'included')),
  amount numeric(14, 4),
  currency text,
  billing_unit text not null check (billing_unit in ('per_container', 'per_shipment', 'per_truck', 'per_time', 'per_km')),
  distance_basis text check (distance_basis in ('one_way', 'round_trip')),
  times_multiplier numeric(10, 2),
  origin_port_id uuid references public.ports (id),
  destination_port_id uuid references public.ports (id),
  route_id uuid references public.routes (id),
  carrier_id uuid references public.carriers (id),
  container_type_id uuid references public.container_types (id),
  cargo_type text not null default 'any' check (cargo_type in ('any', 'general', 'sensitive')),
  included_in_item_id uuid references public.charge_items (id),
  valid_from date not null,
  valid_to date not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'expired', 'archived')),
  business_confirmed boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'demo')),
  notes_zh text,
  notes_en text,
  notes_fr text,
  internal_note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (pricing_mode <> 'manual' or amount is null),
  check (pricing_mode <> 'included' or amount is null),
  check (currency is null or char_length(currency) = 3),
  check (
    status <> 'published'
    or pricing_mode <> 'fixed'
    or (
      amount is not null
      and currency is not null
      and business_confirmed
      and (billing_unit <> 'per_km' or distance_basis is not null)
      and (billing_unit <> 'per_time' or (times_multiplier is not null and times_multiplier > 0))
    )
  )
);

create trigger charge_rules_touch
before update on public.charge_rules
for each row execute function public.touch_updated_at();

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null,
  rate numeric(18, 8) not null check (rate > 0),
  source text not null check (char_length(source) > 0),
  effective_at timestamptz not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (base_currency <> quote_currency),
  check (char_length(base_currency) = 3 and char_length(quote_currency) = 3)
);

create index exchange_rates_lookup_idx
  on public.exchange_rates (base_currency, quote_currency, effective_at desc);

-- ---------------------------------------------------------------------------
-- Quotes are snapshots. Updates and deletes are rejected.
-- ---------------------------------------------------------------------------

create sequence public.quote_number_seq;
create sequence public.inquiry_number_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  user_id uuid not null references public.profiles (id),
  locale text not null check (locale in ('zh', 'en', 'fr')),
  rate_version_id uuid not null references public.freight_rate_versions (id),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.prevent_quote_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'saved quotes are immutable';
end;
$$;

create trigger quotes_immutable
before update or delete on public.quotes
for each row execute function public.prevent_quote_mutation();

create index quotes_user_idx on public.quotes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Inquiries
-- ---------------------------------------------------------------------------

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique,
  user_id uuid references public.profiles (id),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'won', 'closed')),
  contact_name text not null,
  company_name text,
  phone text,
  whatsapp text,
  origin_port_id uuid not null references public.ports (id),
  destination_port_id uuid not null references public.ports (id),
  container_type_id uuid not null references public.container_types (id),
  quantity int not null check (quantity between 1 and 40),
  cargo_name text not null,
  pieces int check (pieces is null or pieces >= 0),
  weight_kg numeric(12, 3) check (weight_kg is null or weight_kg >= 0),
  volume_cbm numeric(12, 3) check (volume_cbm is null or volume_cbm >= 0),
  special_cargo text,
  load_address text,
  ready_date date,
  need_trucking boolean not null default false,
  need_export_customs boolean not null default false,
  need_dest_customs boolean not null default false,
  need_delivery boolean not null default false,
  notes text,
  assigned_to uuid references public.profiles (id),
  locale text not null check (locale in ('zh', 'en', 'fr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger inquiries_touch
before update on public.inquiries
for each row execute function public.touch_updated_at();

create table public.inquiry_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.inquiry_files (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_at timestamptz not null default now()
);

create index inquiries_status_idx on public.inquiries (status, created_at desc);
create index inquiries_user_idx on public.inquiries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Site content and settings
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  company_name_zh text not null,
  company_name_en text not null,
  company_name_fr text not null,
  legal_name_zh text not null,
  legal_name_en text not null,
  legal_name_fr text not null,
  logo_path text,
  phone text not null,
  email text not null,
  whatsapp text not null,
  address_zh text not null,
  address_en text not null,
  address_fr text not null,
  hours_zh text not null,
  hours_en text not null,
  hours_fr text not null,
  require_login_for_prices boolean not null default false,
  reference_currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  is_published boolean not null default true,
  question_zh text not null check (char_length(question_zh) > 0),
  question_en text not null check (char_length(question_en) > 0),
  question_fr text not null check (char_length(question_fr) > 0),
  answer_zh text not null check (char_length(answer_zh) > 0),
  answer_en text not null check (char_length(answer_en) > 0),
  answer_fr text not null check (char_length(answer_fr) > 0),
  updated_at timestamptz not null default now()
);

create table public.page_blocks (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (page_key in ('services', 'terms')),
  sort_order int not null default 0,
  is_published boolean not null default true,
  title_zh text not null check (char_length(title_zh) > 0),
  title_en text not null check (char_length(title_en) > 0),
  title_fr text not null check (char_length(title_fr) > 0),
  body_zh text not null check (char_length(body_zh) > 0),
  body_en text not null check (char_length(body_en) > 0),
  body_fr text not null check (char_length(body_fr) > 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auth challenges, rate limits, imports, audit
-- ---------------------------------------------------------------------------

create table public.captcha_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('login', 'register')),
  session_hash text not null,
  answer_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index captcha_session_idx
  on public.captcha_challenges (session_hash, purpose, created_at desc);

create table public.login_clearances (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index login_clearances_email_idx
  on public.login_clearances (email_normalized, expires_at desc);

create table public.rate_limit_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  hit_count int not null check (hit_count >= 0)
);

create or replace function public.consume_rate_limit(
  p_key text,
  p_window_seconds int,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  if p_window_seconds <= 0 or p_limit <= 0 then
    return false;
  end if;

  insert into public.rate_limit_buckets as bucket (bucket_key, window_start, hit_count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
  set
    window_start = case
      when bucket.window_start + make_interval(secs => p_window_seconds) <= now() then now()
      else bucket.window_start
    end,
    hit_count = case
      when bucket.window_start + make_interval(secs => p_window_seconds) <= now() then 1
      else bucket.hit_count + 1
    end
  returning hit_count into current_count;

  return current_count <= p_limit;
end;
$$;

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  status text not null check (status in ('preview', 'committed', 'abandoned')),
  filename text not null,
  payload jsonb not null,
  error_count int not null default 0,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Login hook: password grants need a one-time clearance created by this app.
-- Refresh keeps working. Recovery, magic link, OTP and signup grants do not.
-- ---------------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  method text := coalesce(event->>'authentication_method', '');
  email text := lower(coalesce(event->'claims'->>'email', ''));
  clearance uuid;
  claims jsonb := event->'claims';
begin
  if method = 'token_refresh' then
    return jsonb_build_object('claims', claims);
  end if;

  if method <> 'password' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'This sign-in method is disabled.'
      )
    );
  end if;

  select id into clearance
  from public.login_clearances
  where email_normalized = email
    and consumed_at is null
    and expires_at > now()
  order by created_at asc
  for update skip locked
  limit 1;

  if clearance is null then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Sign-in was not authorized by the application.'
      )
    );
  end if;

  update public.login_clearances
  set consumed_at = now()
  where id = clearance;

  return jsonb_build_object('claims', claims);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants and RLS.
-- Sensitive rows are not granted to the browser roles. The Next.js server
-- uses the service role after its own authorization checks. RLS remains as
-- a second layer for the few tables the signed-in role can read.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.revoked_sessions enable row level security;
alter table public.countries enable row level security;
alter table public.ports enable row level security;
alter table public.carriers enable row level security;
alter table public.container_types enable row level security;
alter table public.routes enable row level security;
alter table public.freight_rate_versions enable row level security;
alter table public.freight_rate_prices enable row level security;
alter table public.charge_items enable row level security;
alter table public.charge_rules enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.quotes enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_events enable row level security;
alter table public.inquiry_files enable row level security;
alter table public.site_settings enable row level security;
alter table public.faq_items enable row level security;
alter table public.page_blocks enable row level security;
alter table public.captcha_challenges enable row level security;
alter table public.login_clearances enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select on public.countries, public.ports, public.container_types, public.carriers, public.routes, public.charge_items, public.site_settings, public.faq_items, public.page_blocks to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, company_name, phone, whatsapp, locale) on public.profiles to authenticated;

grant select on public.quotes to authenticated;
grant select on public.inquiries, public.inquiry_events, public.inquiry_files to authenticated;

grant select, update on public.freight_rate_versions, public.freight_rate_prices, public.charge_rules, public.exchange_rates, public.import_batches, public.audit_logs to authenticated;
grant select, update on public.inquiries to authenticated;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_staff());

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy reference_select_countries on public.countries
for select to anon, authenticated using (true);
create policy reference_select_ports on public.ports
for select to anon, authenticated using (is_active or public.is_staff());
create policy reference_select_containers on public.container_types
for select to anon, authenticated using (is_active or public.is_staff());
create policy reference_select_carriers on public.carriers
for select to anon, authenticated using ((is_active and visibility = 'public') or public.is_staff());
create policy reference_select_routes on public.routes
for select to anon, authenticated using (is_active or public.is_staff());
create policy reference_select_charges on public.charge_items
for select to anon, authenticated using (is_active or public.is_staff());
create policy reference_select_settings on public.site_settings
for select to anon, authenticated using (true);
create policy reference_select_faq on public.faq_items
for select to anon, authenticated using (is_published or public.is_staff());
create policy reference_select_blocks on public.page_blocks
for select to anon, authenticated using (is_published or public.is_staff());

-- Customers never receive cost columns: the table is not granted to anon,
-- and authenticated staff access is still filtered below. The application
-- additionally projects an explicit column list.
create policy rates_staff_select on public.freight_rate_versions
for select to authenticated
using (public.is_staff());

create policy rate_prices_staff_select on public.freight_rate_prices
for select to authenticated
using (public.is_staff());

create policy charge_rules_staff on public.charge_rules
for select to authenticated
using (public.is_staff());

create policy fx_staff on public.exchange_rates
for select to authenticated
using (public.is_staff());

create policy quotes_select_own on public.quotes
for select to authenticated
using (user_id = auth.uid() or public.is_staff());

create policy inquiries_select_own on public.inquiries
for select to authenticated
using (user_id = auth.uid() or public.is_staff());

create policy inquiry_events_select_own on public.inquiry_events
for select to authenticated
using (
  exists (
    select 1 from public.inquiries
    where inquiries.id = inquiry_events.inquiry_id
      and (inquiries.user_id = auth.uid() or public.is_staff())
  )
);

create policy inquiry_files_select_own on public.inquiry_files
for select to authenticated
using (
  exists (
    select 1 from public.inquiries
    where inquiries.id = inquiry_files.inquiry_id
      and (inquiries.user_id = auth.uid() or public.is_staff())
  )
);

create policy imports_staff on public.import_batches
for select to authenticated
using (public.is_staff());

create policy audit_admin on public.audit_logs
for select to authenticated
using (public.is_admin());

create policy inquiries_staff_update on public.inquiries
for update to authenticated
using (public.is_staff())
with check (public.is_staff());

grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select, update on public.login_clearances to supabase_auth_admin;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.consume_rate_limit(text, int, int) to service_role;
  end if;
end $$;

-- Storage buckets exist only on the Supabase platform.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values
      ('inquiry-files', 'inquiry-files', false, 8388608),
      ('brand', 'brand', true, 2097152)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Master data. These are port facts and fee names, not freight prices.
-- ---------------------------------------------------------------------------

insert into public.countries (code, name_zh, name_en, name_fr) values
  ('CN', '中国', 'China', 'Chine'),
  ('CI', '科特迪瓦', 'Côte d''Ivoire', 'Côte d''Ivoire'),
  ('GH', '加纳', 'Ghana', 'Ghana');

insert into public.ports (code, country_code, name_zh, name_en, name_fr, timezone, kind, sort_order) values
  ('CNNSA', 'CN', '广州南沙', 'Guangzhou Nansha', 'Nansha, Guangzhou', 'Asia/Shanghai', 'origin', 1),
  ('CNNGB', 'CN', '宁波', 'Ningbo', 'Ningbo', 'Asia/Shanghai', 'origin', 2),
  ('CIABJ', 'CI', '阿比让', 'Abidjan', 'Abidjan', 'Africa/Abidjan', 'destination', 3),
  ('GHTEM', 'GH', '特马', 'Tema', 'Tema', 'Africa/Accra', 'destination', 4);

insert into public.container_types (code, name_zh, name_en, name_fr, sort_order) values
  ('20GP', '20英尺普柜', '20'' general purpose', '20 pieds dry', 1),
  ('40GP', '40英尺普柜', '40'' general purpose', '40 pieds dry', 2),
  ('40HQ', '40英尺高柜', '40'' high cube', '40 pieds high cube', 3);

insert into public.charge_items (code, name_zh, name_en, name_fr, description_zh, description_en, description_fr, sort_order) values
  ('THC', '港杂费', 'Origin terminal handling', 'Frais de terminal au départ', '起运港码头作业费用。', 'Terminal handling at the port of loading.', 'Manutention au terminal du port de chargement.', 1),
  ('TRUCK', '拖车费', 'Trucking', 'Camionnage', '工厂到码头的拖车。单程或往返由规则决定。', 'Haulage from the loading place to the terminal. One-way or round trip is set by the rule.', 'Traction du lieu de chargement au terminal. L''aller simple ou l''aller-retour est défini par la règle.', 2),
  ('GATE', '入闸提柜', 'Gate-in and container pickup', 'Entrée terminal et prise de conteneur', '入闸、提柜等操作。计次方式由规则决定。', 'Gate-in, empty pickup and related handling. The count is set by the rule.', 'Entrée terminal, prise du vide et opérations liées. Le nombre est défini par la règle.', 3),
  ('EXPORT_CUSTOMS', '报关费', 'Export customs clearance', 'Dédouanement export', '起运港出口报关。', 'Export declaration at origin.', 'Déclaration d''exportation au départ.', 4),
  ('DEST_CUSTOMS', '目的港清关', 'Destination customs clearance', 'Dédouanement à destination', '目的港清关服务。', 'Customs clearance at destination.', 'Dédouanement au port de destination.', 5),
  ('DEST_DUTY', '目的港税费', 'Destination duty and tax', 'Droits et taxes à destination', '关税及其他目的港税费。', 'Duty and other destination taxes.', 'Droits de douane et autres taxes à destination.', 6),
  ('INSPECTION', '查验费', 'Inspection', 'Inspection', '海关或码头查验。', 'Customs or terminal inspection.', 'Inspection douanière ou au terminal.', 7),
  ('STORAGE', '仓租', 'Storage', 'Magasinage', '超期堆存或仓储。', 'Storage or demurrage-related warehousing.', 'Entreposage ou surestaries de stockage.', 8),
  ('DELIVERY', '派送费', 'Delivery', 'Livraison', '目的港后的派送。', 'On-carriage after the destination port.', 'Livraison après le port de destination.', 9),
  ('OTHER', '其他附加费', 'Other surcharge', 'Autre surcharge', '未单独列出的附加费。', 'A surcharge that is not listed separately.', 'Surcharge non listée séparément.', 10);

insert into public.site_settings (
  company_name_zh, company_name_en, company_name_fr,
  legal_name_zh, legal_name_en, legal_name_fr,
  phone, email, whatsapp,
  address_zh, address_en, address_fr,
  hours_zh, hours_en, hours_fr,
  require_login_for_prices, reference_currency
) values (
  '一帆物流', 'Yifan Logistics', 'Yifan Logistics',
  '公司法定名称待定', 'Legal entity name to be confirmed', 'Raison sociale à confirmer',
  '+86 000 0000 0000', 'placeholder@example.com', '+86 000 0000 0000',
  '办公地址待定', 'Office address to be confirmed', 'Adresse du bureau à confirmer',
  '工作时间待定', 'Business hours to be confirmed', 'Horaires à confirmer',
  false, 'USD'
);
