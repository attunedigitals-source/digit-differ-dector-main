-- Aggregated Daily Performance View for Scale
CREATE OR REPLACE VIEW public.admin_user_daily_summary AS
SELECT 
    user_id,
    deriv_loginid,
    date(timestamp) as trade_date,
    count(*) as total_trades,
    count(*) FILTER (WHERE result = 'won') as wins,
    sum(profit_loss) as daily_profit
FROM public.trades
GROUP BY user_id, deriv_loginid, date(timestamp)
ORDER BY trade_date DESC;
