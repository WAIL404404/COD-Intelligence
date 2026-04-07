# COD Intelligence Pilot

Pilot-first COD decision and confirmation system for Moroccan Shopify merchants. This repo implements a conservative `Next.js + Supabase` modular monolith focused on one production loop:

`Shopify intake -> normalization -> weighted risk scoring -> WhatsApp outreach or manual review -> merchant final decision -> later outcome capture`

## What ships in this repo

- Merchant dashboard for queues, rules, templates, outcomes, and order review
- Lightweight internal ops console for pilot support
- Shopify webhook endpoint with signature verification and idempotency hook
- WhatsApp webhook endpoint for verification and inbound reply classification
- DB-backed worker endpoint for outbound messaging and timeout jobs
- Supabase migration with tenant-aware tables, RLS posture, and seeded defaults
- Demo mode so the full workflow can be explored before Supabase is configured

## Stack

- `Next.js 16` with the App Router
- `Supabase Auth + Postgres`
- `Tailwind CSS 4`
- `Vitest` for domain and webhook helper tests

## Demo mode vs live mode

If the Supabase env vars are missing, the app automatically falls back to seeded pilot data. This keeps the workflow reviewable while the backend is still being wired.

Live mode activates when these env vars are set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill the Supabase and provider secrets
3. Install dependencies
4. Run the app

```bash
npm install
npm run dev
```

## Environment variables

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SHOPIFY_WEBHOOK_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WORKER_SHARED_SECRET=
CRON_SECRET=
```

## Database bootstrap

Apply the migration in [`supabase/migrations/202604030100_pilot_foundation.sql`](./supabase/migrations/202604030100_pilot_foundation.sql).

After creating a merchant, call:

```sql
select public.seed_merchant_defaults('<merchant_uuid>');
```

That seeds:

- the pilot rule set
- French-first WhatsApp templates

## Main routes

- `/dashboard` merchant queue and KPI surface
- `/dashboard/orders/[id]` order review, override, and outcome capture
- `/dashboard/onboarding` readiness checklist
- `/dashboard/rules` weighted rule catalog
- `/dashboard/templates` WhatsApp journeys
- `/dashboard/outcomes` recorded outcomes
- `/internal` lightweight cross-merchant support console
- `/api/webhooks/shopify` Shopify intake
- `/api/webhooks/whatsapp` Meta verification and inbound replies
- `/api/jobs/process` worker batch processor

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Testing

Current automated coverage focuses on the core pilot logic:

- Moroccan phone and order normalization
- weighted scoring and hard-stop precedence
- WhatsApp reply classification
- Shopify webhook signature verification

## Notes

- New merchants are expected to start in conservative automation mode.
- Live processing is designed for `new orders only` after go-live.
- Final order outcomes can be recorded later and manually in v1.
- Approved WhatsApp template names are stored in `message_templates.name`.
- [`vercel.json`](./vercel.json) schedules the worker endpoint every 5 minutes. Use a Vercel plan that supports that cron frequency.
