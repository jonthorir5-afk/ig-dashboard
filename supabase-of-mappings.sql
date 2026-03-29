CREATE TABLE IF NOT EXISTS public.of_link_mappings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_link_name text NOT NULL,
  tracking_link_url text,
  model_id uuid REFERENCES public.models(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(tracking_link_name)
);

-- Enable RLS
ALTER TABLE public.of_link_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users unrestricted access to mappings
CREATE POLICY "Allow all actions for authenticated users" 
ON public.of_link_mappings FOR ALL USING (auth.role() = 'authenticated');
