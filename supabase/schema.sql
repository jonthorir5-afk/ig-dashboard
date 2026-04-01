-- ============================================================
-- Social Media Dashboard - Database Schema
-- Run this in Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends Supabase Auth users with roles)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role text not null default 'operator' check (role in ('admin', 'manager', 'operator')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 2. MODELS (the creators we manage)
-- ============================================================
create table models (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  display_name text,
  status text not null default 'Active' check (status in ('Active', 'Onboarding', 'Paused', 'Terminated')),
  of_username text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. ACCOUNTS (social media accounts tied to a model)
-- ============================================================
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid not null references models(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'twitter', 'reddit', 'tiktok')),
  handle text not null,
  of_username_override text,
  account_url text,
  account_type text not null default 'Primary' check (account_type in ('Primary', 'Secondary', 'Backup', 'Farm')),
  status text not null default 'Active' check (status in ('Active', 'Shadowbanned', 'Suspended', 'Warming Up')),
  health text not null default 'Clean' check (health in ('Clean', 'Shadowbanned', 'Restricted', 'Action Blocked', 'Suspended', 'Limited', 'Under Review', 'Karma Farming')),
  assigned_operator uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 4. SNAPSHOTS (daily/weekly metric captures per account)
-- ============================================================
create table snapshots (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  snapshot_date date not null default current_date,
  captured_by text default 'Manual' check (captured_by in ('Manual', 'API', 'Script')),
  notes text,
  created_by uuid references profiles(id),

  -- Common metrics (all platforms)
  followers integer,
  following integer,

  -- Instagram metrics
  ig_views_7d integer,
  ig_views_30d integer,
  ig_views_90d integer,
  ig_reach_7d integer,
  ig_profile_visits_7d integer,
  ig_link_clicks_7d integer,
  ig_reels_posted_7d integer,
  ig_stories_posted_7d integer,
  ig_top_reel_views integer,

  -- Twitter metrics
  tw_impressions_7d integer,
  tw_views_7d integer,
  tw_retweets_7d integer,
  tw_likes_7d integer,
  tw_replies_7d integer,
  tw_link_clicks_7d integer,
  tw_tweets_posted_7d integer,
  tw_dms_sent_7d integer,
  tw_dm_response_rate numeric(5,2),

  -- Reddit metrics
  rd_karma_total integer,
  rd_posts_7d integer,
  rd_avg_upvotes_7d integer,
  rd_total_views_7d integer,
  rd_comments_received_7d integer,
  rd_top_post_upvotes integer,
  rd_link_clicks_7d integer,
  rd_subreddits_posted_7d integer,
  rd_account_age_days integer,
  rd_ban_log text,

  -- TikTok metrics
  tt_views_7d integer,
  tt_likes_7d integer,
  tt_comments_7d integer,
  tt_shares_7d integer,
  tt_videos_posted_7d integer,
  tt_avg_watch_time numeric(6,2),
  tt_profile_views_7d integer,
  tt_link_clicks_7d integer,
  tt_live_hours_7d numeric(5,2),
  tt_live_peak_viewers integer,

  -- Calculated fields (computed on insert/update via trigger or app logic)
  vtfr_weekly numeric(7,2),
  engagement_rate_weekly numeric(7,2),
  wow_followers_pct numeric(7,2),
  wow_views_pct numeric(7,2),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Prevent duplicate snapshots for same account on same day
  unique(account_id, snapshot_date)
);

-- ============================================================
-- 5. POSTS (per-post data for VTFR/ER calculation)
-- ============================================================
create table posts (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid not null references snapshots(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  platform text not null,
  post_index integer, -- order within the snapshot (1st post, 2nd post, etc.)
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  -- Auto-calculated
  vtfr numeric(7,2),
  engagement_rate numeric(7,2),
  created_at timestamptz default now()
);

-- ============================================================
-- 6. INDEXES for query performance
-- ============================================================
create index idx_accounts_model on accounts(model_id);
create index idx_accounts_platform on accounts(platform);
create index idx_accounts_operator on accounts(assigned_operator);
create index idx_snapshots_account on snapshots(account_id);
create index idx_snapshots_date on snapshots(snapshot_date);
create index idx_snapshots_account_date on snapshots(account_id, snapshot_date desc);
create index idx_posts_snapshot on posts(snapshot_id);

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table models enable row level security;
alter table accounts enable row level security;
alter table snapshots enable row level security;
alter table posts enable row level security;

-- Profiles: users can read all profiles, update their own
create policy "Profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on profiles for update to authenticated using (id = auth.uid());

-- Models: all authenticated users can read, admins/managers can insert/update
create policy "Models viewable by authenticated users"
  on models for select to authenticated using (true);
create policy "Admins and managers can insert models"
  on models for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));
create policy "Admins and managers can update models"
  on models for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));
create policy "Admins can delete models"
  on models for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Accounts: authenticated users see all, admins can manage
create policy "Accounts viewable by authenticated users"
  on accounts for select to authenticated using (true);
create policy "Admins and managers can insert accounts"
  on accounts for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));
create policy "Admins and managers can update accounts"
  on accounts for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));
create policy "Admins can delete accounts"
  on accounts for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Snapshots: all authenticated can read, all authenticated can insert (operators enter data)
create policy "Snapshots viewable by authenticated users"
  on snapshots for select to authenticated using (true);
create policy "Authenticated users can insert snapshots"
  on snapshots for insert to authenticated with check (true);
create policy "Users can update their own snapshots"
  on snapshots for update to authenticated
  using (created_by = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));

-- Posts: same as snapshots
create policy "Posts viewable by authenticated users"
  on posts for select to authenticated using (true);
create policy "Authenticated users can insert posts"
  on posts for insert to authenticated with check (true);
create policy "Posts updatable by admins/managers"
  on posts for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'manager')));

-- ============================================================
-- 8. AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger models_updated_at before update on models
  for each row execute function update_updated_at();
create trigger accounts_updated_at before update on accounts
  for each row execute function update_updated_at();
create trigger snapshots_updated_at before update on snapshots
  for each row execute function update_updated_at();
create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- 9. FUNCTION: Auto-create profile on user signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'operator')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
