ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS of_username_override text;

UPDATE public.accounts
SET of_username_override = 'ethebarbieuncensored'
WHERE handle = 'Ebarbiexxgirl';
