create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  slug text not null unique,
  business_name text not null,
  owner_name text not null default '',
  category text not null default '',
  description text not null default '',
  city text not null default 'Lagos',
  service_modes text[] not null default array['studio'],
  studio_address text not null default '',
  location_fees jsonb not null default '[]'::jsonb,
  outside_area_rule text not null default 'Quote required',
  working_hours jsonb not null default '{"mon":{"open":"09:00","close":"18:00"},"tue":{"open":"09:00","close":"18:00"},"wed":{"open":"09:00","close":"18:00"},"thu":{"open":"09:00","close":"18:00"},"fri":{"open":"09:00","close":"18:00"},"sat":{"open":"07:00","close":"17:00"},"sun":null}'::jsonb,
  buffer_minutes int not null default 30,
  min_notice_hours int not null default 12,
  max_bookings_per_day int not null default 4,
  blocked_dates date[] not null default '{}',
  deposit_type text not null default 'percent',
  deposit_value int not null default 30,
  hold_minutes int not null default 30,
  negotiation jsonb not null default '{"enabled":true,"max_rounds":3,"protect_weekends":true,"below_preferred_needs_deposit_now":true,"weekday_discount":5000,"studio_discount":5000,"pay_now_discount":3000}'::jsonb,
  escalate_group_over int not null default 6,
  cancellation_policy text not null default 'Deposit refundable up to 48 hours before. Transferable once up to 24 hours before. Forfeited for same-day cancellation.',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.vendors to authenticated;
grant all on public.vendors to service_role;
alter table public.vendors enable row level security;
create policy "owner manages vendor" on public.vendors for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.owns_vendor(_vendor uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendors where id = _vendor and owner_id = auth.uid())
$$;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_minutes int not null default 60,
  list_price int not null,
  preferred_price int not null,
  floor_price int not null,
  group_price_per_person int,
  is_addon boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "owner manages services" on public.services for all to authenticated using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_name text not null default '',
  customer_phone text not null default '',
  status text not null default 'inquiry',
  bucket text not null default 'in_progress',
  ai_paused boolean not null default false,
  service_id uuid references public.services(id) on delete set null,
  addon_ids uuid[] not null default '{}',
  party_size int not null default 1,
  location_area text not null default '',
  service_mode text not null default 'studio',
  travel_fee int not null default 0,
  last_counter int,
  agreed_price int,
  total_price int,
  deposit_amount int,
  start_at timestamptz,
  end_at timestamptz,
  hold_expires_at timestamptz,
  deposit_paid_at timestamptz,
  payment_reference text,
  negotiation_rounds int not null default 0,
  escalation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "owner manages conversations" on public.conversations for all to authenticated using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  ui_message jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "owner manages messages" on public.messages for all to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and public.owns_vendor(c.vendor_id)))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and public.owns_vendor(c.vendor_id)));

create table public.events (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  kind text not null,
  amount int,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "owner reads events" on public.events for all to authenticated using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create index on public.conversations (vendor_id, start_at);
create index on public.messages (conversation_id, created_at);
create index on public.events (vendor_id, created_at);