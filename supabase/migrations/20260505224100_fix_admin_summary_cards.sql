-- Redefine get_user_account_daily_pl to prioritize reported stats
CREATE OR REPLACE FUNCTION public.get_user_account_daily_pl(
    p_user_id UUID,
    p_account_id TEXT,
    p_timezone TEXT DEFAULT 'UTC'
)
RETURNS NUMERIC AS $$
DECLARE
    v_reported_profit NUMERIC;
    v_db_profit NUMERIC;
BEGIN
    -- 1. Primary: Use the accurate report from the client (UTC based)
    -- We use this for "Today" stats regardless of timezone to match the bot's UTC logic
    SELECT reported_profit INTO v_reported_profit
    FROM public.daily_reports
    WHERE user_id = p_user_id
    AND deriv_loginid = p_account_id
    AND trade_date = (now() AT TIME ZONE 'UTC')::date;

    IF v_reported_profit IS NOT NULL THEN
        RETURN v_reported_profit;
    END IF;

    -- 2. Fallback: Calculate from trades table for the specific timezone
    SELECT COALESCE(SUM(profit_loss), 0)::NUMERIC INTO v_db_profit
    FROM public.trades
    WHERE user_id = p_user_id
    AND deriv_loginid = p_account_id
    AND (timestamp AT TIME ZONE p_timezone)::date = (now() AT TIME ZONE p_timezone)::date;

    RETURN v_db_profit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure permissions
GRANT EXECUTE ON FUNCTION public.get_user_account_daily_pl(UUID, TEXT, TEXT) TO authenticated;
