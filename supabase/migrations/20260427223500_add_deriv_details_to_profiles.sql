-- Add Deriv details to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deriv_loginid TEXT,
ADD COLUMN IF NOT EXISTS deriv_email TEXT;

-- Update the admin view to include these new columns
DROP VIEW IF EXISTS public.admin_user_performance;
CREATE OR REPLACE VIEW public.admin_user_performance AS
WITH base_stats AS (
    SELECT 
        user_id,
        deriv_loginid,
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE result = 'won') as wins,
        SUM(profit_loss) as net_profit,
        COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as today_trades,
        COALESCE(SUM(profit_loss) FILTER (WHERE timestamp >= CURRENT_DATE), 0) as today_profit,
        MAX(timestamp) as last_trade_at
    FROM public.trades
    GROUP BY user_id, deriv_loginid
)
SELECT 
    bs.*,
    CASE 
        WHEN bs.total_trades > 0 THEN (bs.wins::FLOAT / bs.total_trades) * 100 
        ELSE 0 
    END as win_rate
FROM base_stats bs;

GRANT SELECT ON public.admin_user_performance TO authenticated;
