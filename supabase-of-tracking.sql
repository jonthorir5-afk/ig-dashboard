-- OnlyFans tracking link data
-- Stores daily snapshots of clicks, subscribers, and revenue per tracking link
CREATE TABLE IF NOT EXISTS of_tracking (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null,
  account_id uuid,
  tracking_link_name text not null,
  tracking_link_url text,
  snapshot_date date not null default current_date,
  clicks integer default 0,
  subscribers integer default 0,
  revenue_total numeric(10,2) default 0,
  revenue_per_subscriber numeric(10,2) default 0,
  revenue_per_click numeric(10,2) default 0,
  created_at timestamptz default now(),

  -- One record per model + link + date
  unique(model_id, tracking_link_name, snapshot_date)
);

CREATE INDEX idx_of_tracking_model_date ON of_tracking(model_id, snapshot_date DESC);
CREATE INDEX idx_of_tracking_account ON of_tracking(account_id);

-- Allow service role to manage this table
ALTER TABLE of_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON of_tracking FOR ALL USING (true) WITH CHECK (true);
