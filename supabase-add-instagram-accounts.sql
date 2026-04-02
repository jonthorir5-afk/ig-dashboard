-- Add newly provided Instagram accounts without duplicating existing rows.
-- Assumption: "SinRose" maps to the existing `angelmoon` model.

insert into public.accounts (model_id, platform, handle, account_url, account_type, status, health)
select model_id, platform, handle, account_url, account_type, status, health
from (
  values
    ((select id from public.models where name = 'ariana'), 'instagram', 'arianaangelsxo',   'https://www.instagram.com/arianaangelsxo/',   'Primary', 'Active', 'Clean'),
    ((select id from public.models where name = 'ariana'), 'instagram', 'ariangelsxx',      'https://www.instagram.com/ariangelsxx/',      'Farm',    'Active', 'Clean'),
    ((select id from public.models where name = 'rose'),   'instagram', 'tsporcelainx',     'https://www.instagram.com/tsporcelainx',      'Primary', 'Active', 'Clean'),
    ((select id from public.models where name = 'rose'),   'instagram', 'tsroseporcelain',  'https://www.instagram.com/tsroseporcelain',   'Farm',    'Active', 'Clean'),
    ((select id from public.models where name = 'franche'),'instagram', 'itzchessyxo',      'https://www.instagram.com/itzchessyxo/',      'Primary', 'Active', 'Clean'),
    ((select id from public.models where name = 'angelmoon'),'instagram', 'itssinxo',       'https://www.instagram.com/itssinxo/',         'Primary', 'Active', 'Clean'),
    ((select id from public.models where name = 'moxie'),  'instagram', 'ts.moxie',         'https://www.instagram.com/ts.moxie/',         'Primary', 'Active', 'Clean')
) as new_accounts(model_id, platform, handle, account_url, account_type, status, health)
where model_id is not null
  and not exists (
    select 1
    from public.accounts existing
    where existing.platform = new_accounts.platform
      and lower(existing.handle) = lower(new_accounts.handle)
  );
