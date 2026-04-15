-- Additional platform-specific metrics requested for Accounts views.

alter table public.snapshots
  add column if not exists ig_likes_7d integer,
  add column if not exists ig_comments_7d integer,
  add column if not exists ig_shares_7d integer,
  add column if not exists ig_saves_7d integer,
  add column if not exists tw_bookmarks_7d integer,
  add column if not exists rd_posts_1d integer,
  add column if not exists rd_upvotes_1d integer,
  add column if not exists rd_upvotes_7d integer,
  add column if not exists rd_avg_upvotes_1d integer,
  add column if not exists rd_comments_received_1d integer;
