-- Align live account enum-like constraints with the self-serve account form.

alter table public.accounts
drop constraint if exists accounts_account_type_check;

alter table public.accounts
add constraint accounts_account_type_check
check (account_type in ('Primary', 'Secondary', 'Backup', 'Farm'));

alter table public.accounts
drop constraint if exists accounts_status_check;

alter table public.accounts
add constraint accounts_status_check
check (status in ('Active', 'Paused', 'Suspended', 'Banned', 'Shadowbanned', 'Warming Up'));

