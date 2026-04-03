-- Instagram Meta Graph API connection storage for owned business/creator accounts.

create table if not exists public.instagram_connections (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  meta_app_user_id text,
  instagram_user_id text not null,
  instagram_username text,
  access_token text not null,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id)
);

alter table public.instagram_connections enable row level security;

create policy "Instagram connections are viewable by authenticated users"
  on public.instagram_connections for select to authenticated using (true);

create policy "Instagram connections are insertable by authenticated users"
  on public.instagram_connections for insert to authenticated with check (true);

create policy "Instagram connections are updatable by authenticated users"
  on public.instagram_connections for update to authenticated using (true);

create policy "Instagram connections are deletable by authenticated users"
  on public.instagram_connections for delete to authenticated using (true);

alter table public.accounts
add column if not exists data_source text default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_data_source_check'
  ) then
    alter table public.accounts
      add constraint accounts_data_source_check
      check (data_source in ('manual', 'scraper', 'meta_graph'));
  end if;
end $$;

