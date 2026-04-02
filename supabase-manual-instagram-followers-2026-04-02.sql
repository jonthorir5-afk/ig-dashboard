-- Manual Instagram follower update from operator checks on 2026-04-02.
-- This patches today's snapshot data so the dashboard has real follower counts
-- while Apify Instagram usage is blocked.

-- Ensure the Lola Instagram account exists.
insert into public.accounts (model_id, platform, handle, account_url, account_type, status, health)
select
  (select id from public.models where name = 'lola'),
  'instagram',
  'lolaraytv',
  'https://www.instagram.com/lolaraytv/',
  'Primary',
  'Active',
  'Clean'
where not exists (
  select 1
  from public.accounts
  where platform = 'instagram'
    and lower(handle) = 'lolaraytv'
);

-- Keep Instagram profile URLs current for these handles.
update public.accounts set account_url = 'https://www.instagram.com/arianaangelsxo/'
where platform = 'instagram' and lower(handle) = 'arianaangelsxo';

update public.accounts set account_url = 'https://www.instagram.com/ariangelsxx/'
where platform = 'instagram' and lower(handle) = 'ariangelsxx';

update public.accounts set account_url = 'https://www.instagram.com/tsporcelainx/'
where platform = 'instagram' and lower(handle) = 'tsporcelainx';

update public.accounts set account_url = 'https://www.instagram.com/tsroseporcelain/'
where platform = 'instagram' and lower(handle) = 'tsroseporcelain';

update public.accounts set account_url = 'https://www.instagram.com/itzchessyxo/'
where platform = 'instagram' and lower(handle) = 'itzchessyxo';

update public.accounts set account_url = 'https://www.instagram.com/itssinxo/'
where platform = 'instagram' and lower(handle) = 'itssinxo';

update public.accounts set account_url = 'https://www.instagram.com/ts.moxie/'
where platform = 'instagram' and lower(handle) = 'ts.moxie';

update public.accounts set account_url = 'https://www.instagram.com/lolaraytv/'
where platform = 'instagram' and lower(handle) = 'lolaraytv';

-- Upsert today's manual follower snapshots.
with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'arianaangelsxo' limit 1
), updated as (
  update public.snapshots
  set followers = 145000,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 145000, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'ariangelsxx' limit 1
), updated as (
  update public.snapshots
  set followers = 47500,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 47500, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'tsporcelainx' limit 1
), updated as (
  update public.snapshots
  set followers = 39200,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 39200, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'tsroseporcelain' limit 1
), updated as (
  update public.snapshots
  set followers = 4900,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 4900, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'itzchessyxo' limit 1
), updated as (
  update public.snapshots
  set followers = 36200,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 36200, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'itssinxo' limit 1
), updated as (
  update public.snapshots
  set followers = 6500,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 6500, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'ts.moxie' limit 1
), updated as (
  update public.snapshots
  set followers = 58600,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 58600, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);

with target as (
  select id from public.accounts where platform = 'instagram' and lower(handle) = 'lolaraytv' limit 1
), updated as (
  update public.snapshots
  set followers = 405,
      captured_by = 'Manual-Verified',
      notes = 'Manual IG follower check on 2026-04-02'
  where account_id in (select id from target)
    and snapshot_date = '2026-04-02'
  returning id
)
insert into public.snapshots (account_id, snapshot_date, followers, captured_by, notes)
select id, '2026-04-02', 405, 'Manual-Verified', 'Manual IG follower check on 2026-04-02'
from target
where not exists (select 1 from updated);
