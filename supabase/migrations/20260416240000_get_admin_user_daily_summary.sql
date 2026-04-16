-- Aggregated Daily Performance Function for Scale
-- Functions are more robust for UUID type matching than Views
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

-- Ensure authenticated users (admins) can execute this function
GRANT EXECUTE ON FUNCTION public.get_admin_user_daily_summary(UUID) TO authenticated;
