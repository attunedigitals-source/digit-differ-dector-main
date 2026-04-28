-- ADD CONTRACT_ID TO TRADES FOR CORRELATION
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS contract_id TEXT;
CREATE INDEX IF NOT EXISTS idx_trades_contract_id ON public.trades(contract_id);
