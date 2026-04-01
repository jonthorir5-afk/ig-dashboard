-- ============================================================
-- Add Rose's TikTok accounts
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ewquivcuxmrtemxrdpza/sql
-- ============================================================

insert into public.accounts (model_id, platform, handle, account_url, account_type, status, health) values
  (
    (select id from models where name = 'rose'),
    'tiktok', 'porcelain.ts.girl',
    'https://www.tiktok.com/@porcelain.ts.girl',
    'Primary', 'Active', 'Clean'
  ),
  (
    (select id from models where name = 'rose'),
    'tiktok', 'ts.porcelain.bby',
    'https://www.tiktok.com/@ts.porcelain.bby',
    'Farm', 'Active', 'Clean'
  ),
  (
    (select id from models where name = 'rose'),
    'tiktok', 'tsporcelain',
    'https://www.tiktok.com/@tsporcelain',
    'Farm', 'Active', 'Clean'
  ),
  (
    (select id from models where name = 'rose'),
    'tiktok', 'rose.ts3',
    'https://www.tiktok.com/@rose.ts3',
    'Farm', 'Active', 'Clean'
  );

-- Verify
select handle, account_type, status, health
from accounts
where model_id = (select id from models where name = 'rose')
  and platform = 'tiktok'
order by account_type;
