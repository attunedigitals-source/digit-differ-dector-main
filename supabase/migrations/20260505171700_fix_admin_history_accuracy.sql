-- Update Admin Daily Summary View to prioritize reported stats for all history
DROP VIEW IF EXISTS public.admin_user_daily_summary;
CREATE OR REPLACE VIEW public.admin_user_daily_summary AS
WITH db_stats AS (
    SELECT 
        user_id,
        deriv_loginid,
        (timestamp AT TIME ZONE 'UTC')::date as trade_date,
        count(*) as total_trades,
        count(*) FILTER (WHERE result = 'won') as wins,
        sum(profit_loss) as daily_profit
    FROM public.trades
    GROUP BY user_id, deriv_loginid, trade_date
),
reported_stats AS (
    SELECT 
        user_id,
        deriv_loginid,
        trade_date,
        reported_trades as total_trades,
        reported_wins as wins,
        reported_profit as daily_profit
    FROM public.daily_reports
)
SELECT 
    COALESCE(r.user_id, d.user_id) as user_id,
    COALESCE(r.deriv_loginid, d.deriv_loginid) as deriv_loginid,
    COALESCE(r.trade_date, d.trade_date) as trade_date,
    COALESCE(r.total_trades, d.total_trades) as total_trades,
    COALESCE(r.wins, d.wins) as wins,
    COALESCE(r.daily_profit, d.daily_profit) as daily_profit
FROM db_stats d
FULL OUTER JOIN reported_stats r ON 
    d.user_id = r.user_id AND 
    d.deriv_loginid = r.deriv_loginid AND 
    d.trade_date = r.trade_date;

-- Update the RPC function used by the User Detail page
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
    WITH db_stats AS (
        SELECT 
            (timestamp AT TIME ZONE 'UTC')::date as d,
            trades.deriv_loginid as l,
            count(*) as t,
            count(*) FILTER (WHERE result = 'won') as w,
            sum(profit_loss)::NUMERIC as p
        FROM public.trades
        WHERE user_id = p_user_id
        GROUP BY d, l
    ),
    reported_stats AS (
        SELECT 
            dr.trade_date as d,
            dr.deriv_loginid as l,
            dr.reported_trades as t,
            dr.reported_wins as w,
            dr.reported_profit as p
        FROM public.daily_reports dr
        WHERE user_id = p_user_id
    )
    SELECT 
        COALESCE(r.d, b.d) as trade_date,
        COALESCE(r.l, b.l) as deriv_loginid,
        COALESCE(r.t, b.t)::BIGINT as total_trades,
        COALESCE(r.w, b.w)::BIGINT as wins,
        COALESCE(r.p, b.p)::NUMERIC as daily_profit
    FROM db_stats b
    FULL OUTER JOIN reported_stats r ON b.d = r.d AND b.l = r.l
    ORDER BY trade_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant permissions
GRANT SELECT ON public.admin_user_daily_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_daily_summary(UUID) TO authenticated;
