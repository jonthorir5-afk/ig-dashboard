alter table public.posts
  add column if not exists post_index integer,
  add column if not exists post_url text,
  add column if not exists shares integer;
