CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('bookie-daily-ai-charge', '5 23 * * *', 'SELECT public.charge_daily_ai_usage()');