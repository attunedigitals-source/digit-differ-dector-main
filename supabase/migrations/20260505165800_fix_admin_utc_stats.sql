-- Update Admin User Performance View to use strict UTC for "Today" stats
DROP VIEW IF EXISTS public.admin_user_performance;
CREATE OR REPLACE VIEW public.admin_user_performance AS
WITH base_stats AS (
    SELECT 
        user_id,
        deriv_loginid,
        COUNT(*) as total_trades,
        COUNT(*) FILTER (WHERE result = 'won') as wins,
        SUM(profit_loss) as net_profit,
        COUNT(*) FILTER (WHERE (timestamp AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date) as today_trades,
        COALESCE(SUM(profit_loss) FILTER (WHERE (timestamp AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date), 0) as today_profit,
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

-- Update Admin Daily Summary View to use UTC date grouping
DROP VIEW IF EXISTS public.admin_user_daily_summary;
CREATE OR REPLACE VIEW public.admin_user_daily_summary AS
SELECT 
    user_id,
    deriv_loginid,
    (timestamp AT TIME ZONE 'UTC')::date as trade_date,
    count(*) as total_trades,
    count(*) FILTER (WHERE result = 'won') as wins,
    sum(profit_loss) as daily_profit
FROM public.trades
GROUP BY user_id, deriv_loginid, trade_date
ORDER BY trade_date DESC;

-- Ensure get_admin_user_daily_summary function is also perfectly aligned
CREATE OR REPLACE FUNCTION public.get_admin_user_daily_summary(p_user_id UUID)
RETURNS TABLE (
    trade_date DATE,
    deriv_loginid TEXT,
    total_trades BIGINT,
    wins BIGINT,
    daily_profit NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (timestamp AT TIME ZONE 'UTC')::date as trade_date,
        trades.deriv_loginid,
        count(*) as total_trades,
        count(*) FILTER (WHERE result = 'won') as wins,
        sum(profit_loss)::NUMERIC as daily_profit
    FROM public.trades
    WHERE user_id = p_user_id
    GROUP BY trade_date, trades.deriv_loginid
    ORDER BY trade_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT SELECT ON public.admin_user_performance TO authenticated;
GRANT SELECT ON public.admin_user_daily_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_daily_summary(UUID) TO authenticated;
