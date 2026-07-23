-- Make barrier column nullable to support contract types like Even, Odd, Rise, Fall
ALTER TABLE public.trades ALTER COLUMN barrier DROP NOT NULL;
