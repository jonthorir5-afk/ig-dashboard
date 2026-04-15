CREATE TABLE IF NOT EXISTS public.of_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id uuid REFERENCES public.models(id) ON DELETE CASCADE,
    account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
    tracking_link_name text NOT NULL,
    tracking_link_url text,
    snapshot_date date NOT NULL,
    clicks integer DEFAULT 0,
    subscribers integer DEFAULT 0,
    revenue_total numeric DEFAULT 0,
    revenue_per_subscriber numeric DEFAULT 0,
    revenue_per_click numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(account_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.of_tracking ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users unrestricted access to tracking stats
CREATE POLICY "Allow all actions for authenticated users" 
ON public.of_tracking FOR ALL USING (auth.role() = 'authenticated');
