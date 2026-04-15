ALTER TABLE public.of_tracking
DROP CONSTRAINT IF EXISTS of_tracking_model_id_tracking_link_name_snapshot_date_key;

ALTER TABLE public.of_tracking
DROP CONSTRAINT IF EXISTS of_tracking_account_id_snapshot_date_key;

ALTER TABLE public.of_tracking
ADD CONSTRAINT of_tracking_account_id_snapshot_date_key UNIQUE (account_id, snapshot_date);
