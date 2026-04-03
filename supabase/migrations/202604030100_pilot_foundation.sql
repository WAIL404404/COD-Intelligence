create extension if not exists pgcrypto;

create schema if not exists app;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('merchant_admin', 'internal_staff');
  end if;
  if not exists (select 1 from pg_type where typname = 'onboarding_status') then
    create type public.onboarding_status as enum ('setup', 'ready', 'live');
  end if;
  if not exists (select 1 from pg_type where typname = 'connection_provider') then
    create type public.connection_provider as enum ('shopify', 'whatsapp_cloud');
  end if;
  if not exists (select 1 from pg_type where typname = 'connection_status') then
    create type public.connection_status as enum ('pending', 'connected', 'needs_attention');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('new', 'normalized', 'scored', 'awaiting_confirmation', 'awaiting_address', 'manual_review', 'approved_for_shipping', 'blocked', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_level') then
    create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'recommended_action') then
    create type public.recommended_action as enum ('auto_approve', 'send_confirmation', 'request_address', 'manual_review', 'block');
  end if;
  if not exists (select 1 from pg_type where typname = 'decision_value') then
    create type public.decision_value as enum ('approved_for_shipping', 'hold', 'manual_review', 'blocked', 'awaiting_customer');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_journey') then
    create type public.message_journey as enum ('confirmation', 'address_clarification');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_direction') then
    create type public.message_direction as enum ('inbound', 'outbound');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_delivery_status') then
    create type public.message_delivery_status as enum ('queued', 'sent', 'delivered', 'read', 'received');
  end if;
  if not exists (select 1 from pg_type where typname = 'whatsapp_outcome') then
    create type public.whatsapp_outcome as enum ('confirmed', 'canceled', 'address_updated', 'location_shared', 'unclear_reply', 'no_response');
  end if;
  if not exists (select 1 from pg_type where typname = 'final_outcome') then
    create type public.final_outcome as enum ('delivered', 'refused', 'canceled', 'unreachable');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('pending', 'processing', 'retrying', 'completed', 'failed');
  end if;
end $$;

create or replace function app.current_merchant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'merchant_id', '')::uuid
$$;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  locale text not null default 'fr-MA',
  timezone text not null default 'Africa/Casablanca',
  onboarding_status public.onboarding_status not null default 'setup',
  automation_mode text not null default 'conservative',
  go_live_enabled boolean not null default false,
  live_since timestamptz,
  review_sla_minutes integer not null default 30,
  urgent_review_sla_minutes integer not null default 15,
  support_email text,
  pilot_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'merchant_admin',
  created_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table if not exists public.internal_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'internal_staff',
  created_at timestamptz not null default now()
);

create or replace function app.is_internal_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.internal_staff staff
    where staff.user_id = auth.uid()
  )
$$;

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider public.connection_provider not null,
  status public.connection_status not null default 'pending',
  label text not null,
  external_account_id text,
  config_summary text,
  config jsonb not null default '{}'::jsonb,
  error_message text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, provider)
);

create table if not exists public.rule_configs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  code text not null,
  title text not null,
  description text not null,
  enabled boolean not null default true,
  points integer not null,
  severity public.risk_level not null,
  hard_stop boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, code)
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  journey public.message_journey not null,
  locale text not null default 'fr-MA',
  name text not null,
  body text not null,
  variables text[] not null default '{}',
  tone_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, journey, locale)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  source_provider public.connection_provider not null default 'shopify',
  external_id text not null,
  order_number text not null,
  customer_name text not null,
  customer_phone text,
  city text,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'MAD',
  shipping_address jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  source_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, source_provider, external_id)
);

create table if not exists public.normalized_orders (
  order_id uuid primary key references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  normalized_snapshot jsonb not null default '{}'::jsonb,
  phone_normalized text,
  valid_phone boolean not null default false,
  address_line text,
  postal_code text,
  address_quality_score integer not null default 0,
  address_needs_clarification boolean not null default false,
  duplicate_recent_orders integer not null default 0,
  recent_risky_behavior_count integer not null default 0,
  risky_city boolean not null default false,
  blacklisted boolean not null default false,
  high_value boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  risk_score integer not null default 0,
  risk_level public.risk_level not null,
  recommended_action public.recommended_action not null,
  system_decision public.decision_value not null,
  summary text not null,
  reason_codes text[] not null default '{}',
  engine_version text not null default 'pilot-v1',
  created_at timestamptz not null default now()
);

create table if not exists public.risk_reasons (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.risk_assessments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  code text not null,
  label text not null,
  detail text not null,
  points integer not null,
  severity public.risk_level not null,
  hard_stop boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  journey public.message_journey not null,
  latest_outcome public.whatsapp_outcome,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  direction public.message_direction not null,
  delivery_status public.message_delivery_status not null,
  provider_message_id text,
  body text not null default '',
  classified_outcome public.whatsapp_outcome,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_decisions (
  order_id uuid primary key references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  system_decision public.decision_value not null,
  merchant_final_decision public.decision_value,
  current_status public.order_status not null,
  recommended_action public.recommended_action not null,
  awaiting_response_deadline_at timestamptz,
  last_message_outcome public.whatsapp_outcome,
  explanation_summary text not null default '',
  classification_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decision_overrides (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_name text,
  previous_decision public.decision_value,
  new_decision public.decision_value not null,
  override_reason text not null,
  classification_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_outcomes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  final_outcome public.final_outcome not null,
  note text,
  recorded_by uuid references auth.users(id),
  recorded_by_name text,
  source text not null default 'manual',
  recorded_at timestamptz not null default now()
);

create table if not exists public.order_action_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  actor_name text,
  action_type text not null,
  summary text not null,
  prior_snapshot jsonb,
  next_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  provider public.connection_provider not null,
  event_key text not null unique,
  topic text not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.job_queue (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  job_type text not null,
  status public.job_status not null default 'pending',
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_merchant_created on public.orders (merchant_id, source_created_at desc);
create index if not exists idx_normalized_orders_phone on public.normalized_orders (merchant_id, phone_normalized);
create index if not exists idx_risk_assessments_order on public.risk_assessments (order_id, created_at desc);
create index if not exists idx_risk_reasons_order on public.risk_reasons (order_id);
create index if not exists idx_message_threads_order on public.message_threads (order_id);
create index if not exists idx_message_events_thread on public.message_events (thread_id, created_at desc);
create index if not exists idx_message_events_provider_message on public.message_events (provider_message_id);
create index if not exists idx_order_decisions_status on public.order_decisions (merchant_id, current_status);
create index if not exists idx_order_outcomes_outcome on public.order_outcomes (merchant_id, final_outcome);
create index if not exists idx_order_action_logs_order on public.order_action_logs (order_id, created_at desc);
create index if not exists idx_webhook_events_provider_status on public.webhook_events (provider, processing_status, created_at desc);
create index if not exists idx_job_queue_ready on public.job_queue (status, run_at);
create index if not exists idx_channel_connections_external_account on public.channel_connections (provider, external_account_id);

alter table public.merchants enable row level security;
alter table public.channel_connections enable row level security;
alter table public.rule_configs enable row level security;
alter table public.message_templates enable row level security;
alter table public.orders enable row level security;
alter table public.normalized_orders enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_reasons enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_events enable row level security;
alter table public.order_decisions enable row level security;
alter table public.decision_overrides enable row level security;
alter table public.order_outcomes enable row level security;
alter table public.order_action_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.job_queue enable row level security;

create policy "merchant_members_can_read_merchants"
on public.merchants for select
using (
  app.is_internal_staff()
  or id = app.current_merchant_id()
);

create policy "merchant_members_read_tenant_rows"
on public.channel_connections for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "merchant_members_read_rules"
on public.rule_configs for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "merchant_members_read_templates"
on public.message_templates for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "merchant_members_read_orders"
on public.orders for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "merchant_members_manage_decisions"
on public.order_decisions for all
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
)
with check (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "merchant_members_manage_outcomes"
on public.order_outcomes for all
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
)
with check (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_related_rows"
on public.normalized_orders for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_assessments"
on public.risk_assessments for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_reasons"
on public.risk_reasons for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_threads"
on public.message_threads for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_events"
on public.message_events for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_manage_overrides"
on public.decision_overrides for all
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
)
with check (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create policy "tenant_select_logs"
on public.order_action_logs for select
using (
  app.is_internal_staff()
  or merchant_id = app.current_merchant_id()
);

create or replace function public.seed_merchant_defaults(target_merchant uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.rule_configs (merchant_id, code, title, description, points, severity, hard_stop, config)
  values
    (target_merchant, 'phone_validity', 'Phone validity', 'Escalate orders that cannot be reliably reached on WhatsApp.', 42, 'critical', false, '{}'::jsonb),
    (target_merchant, 'address_quality', 'Address completeness', 'Weak addresses should request clarification before shipping.', 28, 'high', false, '{"minScore": 70}'::jsonb),
    (target_merchant, 'duplicate_recent_orders', 'Duplicate recent phone activity', 'Multiple recent COD attempts from the same phone increase risk.', 22, 'high', false, '{"minimumCount": 1}'::jsonb),
    (target_merchant, 'repeated_risky_behavior', 'Repeated risky behavior', 'Past refusals or unreachable outcomes increase risk.', 35, 'critical', false, '{"minimumCount": 2}'::jsonb),
    (target_merchant, 'risky_city', 'Risky city list', 'Cities with elevated COD issues receive a moderate uplift.', 18, 'medium', false, '{"cities":["Tanger","Safi","Meknes"]}'::jsonb),
    (target_merchant, 'high_value_threshold', 'High value threshold', 'High-value COD orders should not bypass confirmation.', 16, 'medium', false, '{"threshold":900}'::jsonb),
    (target_merchant, 'non_response_timeout', 'WhatsApp non-response timeout', 'No response after the pilot timeout escalates to review.', 26, 'high', false, '{"minutes":120}'::jsonb),
    (target_merchant, 'hard_stop_blacklist', 'Blacklist hard stop', 'Known bad actors should be blocked immediately.', 100, 'critical', true, '{"blockedPhones":[]}'::jsonb)
  on conflict (merchant_id, code) do nothing;

  insert into public.message_templates (merchant_id, journey, locale, name, body, variables, tone_hint)
  values
    (target_merchant, 'confirmation', 'fr-MA', 'cod_confirmation_fr', 'Bonjour {{customerName}}, nous confirmons votre commande {{orderNumber}} de {{amount}}. Repondez OUI pour confirmer ou ANNULER si vous ne la souhaitez plus.', array['customerName', 'orderNumber', 'amount'], 'Warm, concise, trust-building'),
    (target_merchant, 'address_clarification', 'fr-MA', 'cod_address_clarification_fr', 'Bonjour {{customerName}}, il nous manque un detail pour livrer la commande {{orderNumber}}. Merci d''envoyer l''adresse complete ou votre localisation WhatsApp.', array['customerName', 'orderNumber'], 'Polite, low-friction, asks only for missing delivery details')
  on conflict (merchant_id, journey, locale) do nothing;
end;
$$;
