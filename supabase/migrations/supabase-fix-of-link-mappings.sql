ALTER TABLE public.of_link_mappings
DROP CONSTRAINT IF EXISTS of_link_mappings_tracking_link_name_key;

ALTER TABLE public.of_link_mappings
ADD CONSTRAINT of_link_mappings_account_id_key UNIQUE (account_id);
