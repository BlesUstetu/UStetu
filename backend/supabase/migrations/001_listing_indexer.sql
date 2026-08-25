-- UStetu Marketplace Discovery
-- Supabase/PostgreSQL migration for the read-only listing indexer.
-- Never use these tables as settlement authority.

create extension if not exists pgcrypto;

create table if not exists public.indexer_events (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null,
  contract_address text not null,
  block_number bigint not null,
  block_hash text,
  transaction_hash text not null,
  log_index integer not null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  finalized_at timestamptz,
  removed boolean not null default false,
  unique (chain_id, contract_address, transaction_hash, log_index)
);

create index if not exists indexer_events_block_idx
  on public.indexer_events (chain_id, contract_address, block_number, log_index);

create index if not exists indexer_events_name_idx
  on public.indexer_events (event_name);

create table if not exists public.indexer_state (
  chain_id bigint not null,
  contract_address text not null,
  last_scanned_block bigint not null default 0,
  last_finalized_block bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract_address)
);

create table if not exists public.listings (
  chain_id bigint not null,
  contract_address text not null,
  listing_id numeric not null,
  seller text not null,
  token_id text not null,
  token_contract text,
  payment_token text not null,
  price numeric not null default 0,
  inventory_deposited numeric not null default 0,
  inventory_locked numeric not null default 0,
  available_inventory numeric generated always as
    (greatest(inventory_deposited - inventory_locked, 0)) stored,
  min_order_amount numeric not null default 0,
  max_order_amount numeric not null default 0,
  status text not null default 'UNKNOWN'
    check (status in ('UNKNOWN','ACTIVE','PAUSED','CLOSED','SUSPENDED')),
  created_at timestamptz,
  updated_at timestamptz,
  last_block_number bigint not null default 0,
  last_transaction_hash text,
  last_log_index integer,
  finalized boolean not null default false,
  primary key (chain_id, contract_address, listing_id)
);

create index if not exists listings_active_idx
  on public.listings (chain_id, contract_address, status, listing_id);

create index if not exists listings_seller_idx
  on public.listings (chain_id, contract_address, seller, listing_id);

create index if not exists listings_token_idx
  on public.listings (chain_id, contract_address, token_contract, listing_id);

create index if not exists listings_updated_idx
  on public.listings (chain_id, contract_address, updated_at desc);

-- API reads are public only through an explicit backend policy.
-- No anonymous INSERT/UPDATE/DELETE is allowed.
alter table public.indexer_events enable row level security;
alter table public.indexer_state enable row level security;
alter table public.listings enable row level security;

-- Read-only public discovery. Writes must use the trusted backend/service role.
drop policy if exists listings_public_read on public.listings;
create policy listings_public_read
  on public.listings
  for select
  to anon, authenticated
  using (true);

-- Keep event/state internals private to the service role.
drop policy if exists indexer_events_service_only on public.indexer_events;
drop policy if exists indexer_state_service_only on public.indexer_state;

create or replace function public.set_indexer_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists indexer_state_updated_at on public.indexer_state;
create trigger indexer_state_updated_at
before update on public.indexer_state
for each row execute function public.set_indexer_state_updated_at();

comment on table public.listings is
  'Read/discovery projection only. UStetuEscrow remains the source of truth.';
comment on table public.indexer_events is
  'Canonical event ledger with idempotency key chain_id + contract_address + transaction_hash + log_index.';
comment on table public.indexer_state is
  'Indexer cursor and finality state.';
