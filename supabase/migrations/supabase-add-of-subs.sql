ALTER TABLE public.models ADD COLUMN IF NOT EXISTS of_subs INTEGER DEFAULT 0;

-- Run this to create the new model tracking table for OnlyFans subscribers!
CREATE TABLE IF NOT EXISTS public.model_snapshots (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  snapshot_date date not null,
  of_subs integer default 0,
  captured_by text default 'API-OnlyFans',
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE public.model_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Model snapshots are viewable by authenticated users"
  ON public.model_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Model snapshots are insertable by authenticated users"
  ON public.model_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Model snapshots are updatable by authenticated users"
  ON public.model_snapshots FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_model_snapshots_model_date ON public.model_snapshots(model_id, snapshot_date desc);
