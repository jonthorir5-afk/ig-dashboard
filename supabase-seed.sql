-- ============================================================
-- Seed data — Models & Accounts
-- Run in Supabase SQL Editor AFTER the schema has been created
-- https://supabase.com/dashboard/project/ewquivcuxmrtemxrdpza/sql
-- ============================================================

-- ── MODELS ──
insert into public.models (id, name, display_name, status, of_username, notes) values
  (uuid_generate_v4(), 'ariana',    'Ariana',    'Active', 'ariana',    ''),
  (uuid_generate_v4(), 'rose',      'Rose',      'Active', 'rose',      ''),
  (uuid_generate_v4(), 'indibaby',  'Indibaby',  'Active', 'indibaby',  ''),
  (uuid_generate_v4(), 'barbie',    'Barbie',    'Active', 'barbie',    ''),
  (uuid_generate_v4(), 'franche',   'Franche',   'Active', 'franche',   ''),
  (uuid_generate_v4(), 'moxie',     'Moxie',     'Active', 'moxie',     ''),
  (uuid_generate_v4(), 'lola',      'Lola',      'Active', 'lola',      ''),
  (uuid_generate_v4(), 'maple',     'Maple',     'Active', 'maple',     ''),
  (uuid_generate_v4(), 'olivia',    'Olivia',    'Active', 'olivia',    ''),
  (uuid_generate_v4(), 'bella',     'Bella',     'Active', 'bella',     ''),
  (uuid_generate_v4(), 'angelmoon', 'AngelMoon', 'Active', 'angelmoon', ''),
  (uuid_generate_v4(), 'dawn',      'Dawn',      'Active', 'dawn',      ''),
  (uuid_generate_v4(), 'gia',       'Gia',       'Active', 'gia',       '');

-- ── ACCOUNTS ──
-- We reference models by name, so we use subqueries

-- ARIANA — 7 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='ariana'), 'twitter', 'ArianaAngelsxo',  'Primary', 'Active', 'Clean'),
  ((select id from models where name='ariana'), 'twitter', 'TsAriAngelsxox',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='ariana'), 'twitter', 'TSArianaAngelsx', 'Farm',    'Active', 'Clean'),
  ((select id from models where name='ariana'), 'twitter', 'TSAriiAngels',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='ariana'), 'twitter', 'TSAngelArii',     'Farm',    'Active', 'Clean'),
  ((select id from models where name='ariana'), 'twitter', 'AriAngelsXo',     'Farm',    'Active', 'Limited'),
  ((select id from models where name='ariana'), 'twitter', 'Isabelacasiu',    'Farm',    'Active', 'Clean');

-- ROSE — 3 X accounts + 1 Reddit + 4 TikTok
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='rose'), 'twitter', 'porcelaingoirl',      'Primary', 'Active', 'Clean'),
  ((select id from models where name='rose'), 'twitter', 'TsPorcelainbby',      'Farm',    'Active', 'Clean'),
  ((select id from models where name='rose'), 'twitter', 'valeriapasion7',      'Farm',    'Active', 'Clean'),
  ((select id from models where name='rose'), 'reddit',  'u/porcelaingoirl',    'Primary', 'Active', 'Clean'),
  ((select id from models where name='rose'), 'tiktok',  'porcelain.ts.girl',   'Primary', 'Active', 'Clean'),
  ((select id from models where name='rose'), 'tiktok',  'ts.porcelain.bby',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='rose'), 'tiktok',  'tsporcelain',         'Farm',    'Active', 'Clean'),
  ((select id from models where name='rose'), 'tiktok',  'rose.ts3',            'Farm',    'Active', 'Clean');

-- INDIBABY — 5 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='indibaby'), 'twitter', 'IndibabyTs',    'Primary', 'Active', 'Clean'),
  ((select id from models where name='indibaby'), 'twitter', 'TsIndigirlxo',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='indibaby'), 'twitter', 'Indibabyxo',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='indibaby'), 'twitter', 'Indibabyx',     'Farm',    'Active', 'Limited'),
  ((select id from models where name='indibaby'), 'twitter', 'TSindibaby',    'Farm',    'Active', 'Clean');

-- BARBIE — 4 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='barbie'), 'twitter', 'Tsbarbiegirlx',   'Primary', 'Active', 'Clean'),
  ((select id from models where name='barbie'), 'twitter', 'Ebarbiebbyx',     'Farm',    'Active', 'Clean'),
  ((select id from models where name='barbie'), 'twitter', 'Tsbarbiegirlxx',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='barbie'), 'twitter', 'Ebarbiexxgirl',   'Farm',    'Active', 'Clean');

-- FRANCHE — 5 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='franche'), 'twitter', 'franchebbyy',     'Primary', 'Active', 'Clean'),
  ((select id from models where name='franche'), 'twitter', 'Tsfrancheexo',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='franche'), 'twitter', 'franchetgirl',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='franche'), 'twitter', 'Tsfranchecutie',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='franche'), 'twitter', 'franchebbyx',     'Farm',    'Active', 'Limited');

-- MOXIE — 5 X accounts + 1 Reddit
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='moxie'), 'twitter', 'moxiedoll',     'Primary', 'Active', 'Clean'),
  ((select id from models where name='moxie'), 'twitter', 'tsdollymoxie',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='moxie'), 'twitter', 'TsMoxiebby',    'Farm',    'Active', 'Clean'),
  ((select id from models where name='moxie'), 'twitter', 'isabelaramir3', 'Farm',    'Active', 'Clean'),
  ((select id from models where name='moxie'), 'twitter', 'moxiedollts',   'Farm',    'Active', 'Clean'),
  ((select id from models where name='moxie'), 'reddit',  'u/Moxied0ll',   'Primary', 'Active', 'Clean');

-- LOLA — 3 X accounts + 1 Reddit
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='lola'), 'twitter', 'transbabydollx', 'Primary', 'Active', 'Clean'),
  ((select id from models where name='lola'), 'twitter', 'TsLolaxox',      'Farm',    'Active', 'Clean'),
  ((select id from models where name='lola'), 'twitter', 'bbytransgirlx',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='lola'), 'reddit',  'u/jungeedosaty', 'Primary', 'Active', 'Clean');

-- MAPLE — 2 X accounts + 1 Reddit
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='maple'), 'twitter', 'LittlemapleB',       'Primary', 'Active', 'Clean'),
  ((select id from models where name='maple'), 'twitter', 'BbyTransCutie',      'Farm',    'Active', 'Clean'),
  ((select id from models where name='maple'), 'reddit',  'u/LittleMapleBerry', 'Primary', 'Active', 'Clean');

-- OLIVIA — 5 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='olivia'), 'twitter', 'TsOliviaxSkye',    'Primary', 'Active', 'Clean'),
  ((select id from models where name='olivia'), 'twitter', 'TsOliviaSkyexox',  'Farm',    'Active', 'Clean'),
  ((select id from models where name='olivia'), 'twitter', 'Oliviacutiexxo',   'Farm',    'Active', 'Clean'),
  ((select id from models where name='olivia'), 'twitter', 'Oliviaskyexx',     'Farm',    'Active', 'Limited'),
  ((select id from models where name='olivia'), 'twitter', 'OliviaSkyexxo',    'Farm',    'Active', 'Clean');

-- BELLA — 2 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='bella'), 'twitter', 'dollytsbella',  'Primary', 'Active', 'Clean'),
  ((select id from models where name='bella'), 'twitter', 'tsbelladollz',  'Farm',    'Active', 'Clean');

-- ANGELMOON — 3 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='angelmoon'), 'twitter', 'SinnyRose',     'Primary', 'Active', 'Clean'),
  ((select id from models where name='angelmoon'), 'twitter', 'TsAngelMoon',   'Farm',    'Active', 'Clean'),
  ((select id from models where name='angelmoon'), 'twitter', 'cutieTsangel',  'Farm',    'Active', 'Clean');

-- DAWN — 2 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='dawn'), 'twitter', 'dawnriveraa', 'Primary', 'Active', 'Clean'),
  ((select id from models where name='dawn'), 'twitter', 'Tsdawnbby',   'Farm',    'Active', 'Clean');

-- GIA — 2 X accounts
insert into public.accounts (model_id, platform, handle, account_type, status, health) values
  ((select id from models where name='gia'), 'twitter', 'Tsbbydollx', 'Primary', 'Active', 'Clean'),
  ((select id from models where name='gia'), 'twitter', 'tsbbygf',    'Farm',    'Active', 'Clean');

-- ============================================================
-- Done! 13 models + 52 accounts (48 Twitter + 4 Reddit) seeded.
-- ============================================================
