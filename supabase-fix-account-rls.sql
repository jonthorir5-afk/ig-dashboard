-- Fix live RLS policies for self-serve account management.
-- Run this in Supabase SQL editor.

alter table public.accounts enable row level security;

drop policy if exists "Accounts are viewable by authenticated users" on public.accounts;
drop policy if exists "Accounts are insertable by authenticated users" on public.accounts;
drop policy if exists "Accounts are updatable by authenticated users" on public.accounts;
drop policy if exists "Accounts are deletable by authenticated users" on public.accounts;

create policy "Accounts are viewable by authenticated users"
  on public.accounts
  for select
  to authenticated
  using (true);

create policy "Accounts are insertable by authenticated users"
  on public.accounts
  for insert
  to authenticated
  with check (true);

create policy "Accounts are updatable by authenticated users"
  on public.accounts
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Accounts are deletable by authenticated users"
  on public.accounts
  for delete
  to authenticated
  using (true);
