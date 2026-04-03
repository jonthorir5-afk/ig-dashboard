-- ============================================================
-- IG Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ewquivcuxmrtemxrdpza/sql
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role text not null default 'operator' check (role in ('admin', 'manager', 'operator')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'operator'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- MODELS
-- ============================================================
create table public.models (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  display_name text not null,
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Retired')),
  of_username text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.models enable row level security;

create policy "Models are viewable by authenticated users"
  on public.models for select to authenticated using (true);

create policy "Models are insertable by authenticated users"
  on public.models for insert to authenticated with check (true);

create policy "Models are updatable by authenticated users"
  on public.models for update to authenticated using (true);

create policy "Models are deletable by authenticated users"
  on public.models for delete to authenticated using (true);

-- ============================================================
-- ACCOUNTS
-- ============================================================
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid not null references public.models(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'twitter', 'reddit', 'tiktok')),
  handle text not null,
  of_username_override text,
  account_type text not null default 'Primary' check (account_type in ('Primary', 'Secondary', 'Backup', 'Farm')),
  account_url text,
  data_source text not null default 'manual' check (data_source in ('manual', 'scraper', 'meta_graph')),
  status text not null default 'Active' check (status in ('Active', 'Paused', 'Suspended', 'Banned', 'Shadowbanned', 'Warming Up')),
  health text not null default 'Clean',
  assigned_operator uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Accounts are viewable by authenticated users"
  on public.accounts for select to authenticated using (true);

create policy "Accounts are insertable by authenticated users"
  on public.accounts for insert to authenticated with check (true);

create policy "Accounts are updatable by authenticated users"
  on public.accounts for update to authenticated using (true);

create policy "Accounts are deletable by authenticated users"
  on public.accounts for delete to authenticated using (true);

-- ============================================================
-- INSTAGRAM CONNECTIONS (Meta Graph API)
-- ============================================================
create table public.instagram_connections (
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

-- ============================================================
-- SNAPSHOTS (weekly metrics per account)
-- ============================================================
create table public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  snapshot_date date not null,
  followers integer,
  following integer,
  captured_by text default 'Manual',
  notes text,
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete set null,

  -- Computed / derived metrics
  vtfr_weekly numeric(6,2),
  engagement_rate_weekly numeric(6,2),
  wow_followers_pct numeric(6,2),
  wow_views_pct numeric(6,2),

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

  -- Twitter / X metrics
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
  tt_live_peak_viewers integer
);

alter table public.snapshots enable row level security;

create policy "Snapshots are viewable by authenticated users"
  on public.snapshots for select to authenticated using (true);

create policy "Snapshots are insertable by authenticated users"
  on public.snapshots for insert to authenticated with check (true);

create policy "Snapshots are updatable by authenticated users"
  on public.snapshots for update to authenticated using (true);

-- Index for fast lookups
create index idx_snapshots_account_date on public.snapshots(account_id, snapshot_date desc);

-- ============================================================
-- MODEL SNAPSHOTS (tracking OF subs & model-level metrics)
-- ============================================================
create table public.model_snapshots (
  id uuid primary key default uuid_generate_v4(),
  model_id uuid not null references public.models(id) on delete cascade,
  snapshot_date date not null,
  of_subs integer default 0,
  captured_by text default 'API-OnlyFans',
  notes text,
  created_at timestamptz default now()
);

alter table public.model_snapshots enable row level security;

create policy "Model snapshots are viewable by authenticated users"
  on public.model_snapshots for select to authenticated using (true);

create policy "Model snapshots are insertable by authenticated users"
  on public.model_snapshots for insert to authenticated with check (true);

create policy "Model snapshots are updatable by authenticated users"
  on public.model_snapshots for update to authenticated using (true);

create index idx_model_snapshots_model_date on public.model_snapshots(model_id, snapshot_date desc);

-- ============================================================
-- POSTS (per-post metrics for VTFR / ER)
-- ============================================================
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  snapshot_id uuid references public.snapshots(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  post_index integer,
  post_url text,
  views integer,
  likes integer,
  comments integer,
  shares integer,
  created_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by authenticated users"
  on public.posts for select to authenticated using (true);

create policy "Posts are insertable by authenticated users"
  on public.posts for insert to authenticated with check (true);

-- ============================================================
-- Done! Now create your first user via the Supabase Auth dashboard
-- or sign up through the app's login page.
-- ============================================================
