ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'NG';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Lagos';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ALTER COLUMN city SET DEFAULT '';
CREATE OR REPLACE FUNCTION public.ai_reply_price()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2
$$;
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (_user, 500) ON CONFLICT (user_id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.wallet_ledger (user_id, kind, amount, note) VALUES (_user, 'topup', 500, 'Welcome credit');
  END IF;
  INSERT INTO public.account_plans (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_ai_reply(_vendor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_usage (vendor_id, day, replies, cost)
  VALUES (_vendor, (now() AT TIME ZONE 'UTC')::date, 1, public.ai_reply_price())
  ON CONFLICT (vendor_id, day) DO UPDATE SET replies = public.ai_usage.replies + 1, cost = public.ai_usage.cost + public.ai_reply_price();
END;
$$;
CREATE OR REPLACE FUNCTION public.charge_daily_ai_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN SELECT u.id, u.vendor_id, u.day, u.cost, u.replies, v.owner_id, v.business_name FROM public.ai_usage u JOIN public.vendors v ON v.id = u.vendor_id WHERE u.charged_at IS NULL AND u.day < (now() AT TIME ZONE 'UTC')::date FOR UPDATE OF u
  LOOP
    INSERT INTO public.wallets (user_id, balance) VALUES (r.owner_id, 0) ON CONFLICT (user_id) DO NOTHING;
    UPDATE public.wallets SET balance = balance - r.cost, updated_at = now() WHERE user_id = r.owner_id;
    INSERT INTO public.wallet_ledger (user_id, vendor_id, kind, amount, day, note) VALUES (r.owner_id, r.vendor_id, 'daily_charge', -r.cost, r.day, concat(r.replies, ' receptionist replies, ', r.business_name));
    UPDATE public.ai_usage SET charged_at = now() WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
CREATE OR REPLACE FUNCTION public.hold_customer_slot_atomic(_conversation_id uuid, _start_at timestamptz, _end_at timestamptz, _customer_name text, _customer_phone text, _agreed_price integer, _total_price integer, _deposit_amount integer, _hold_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vendor_id uuid;
  _buffer interval;
  _max_bookings integer;
  _tz text;
  _existing integer;
BEGIN
  SELECT vendor_id INTO _vendor_id FROM public.conversations WHERE id = _conversation_id FOR UPDATE;
  IF _vendor_id IS NULL OR _start_at IS NULL OR _end_at <= _start_at OR _start_at <= now() THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_vendor_id::text));
  SELECT make_interval(mins => buffer_minutes), max_bookings_per_day, timezone INTO _buffer, _max_bookings, _tz FROM public.vendors WHERE id = _vendor_id;
  SELECT count(*) INTO _existing FROM public.conversations
   WHERE vendor_id = _vendor_id AND id <> _conversation_id
     AND (status IN ('confirmed', 'completed') OR (status IN ('slot_held', 'awaiting_deposit') AND hold_expires_at > now()))
     AND start_at < _end_at + _buffer AND end_at > _start_at - _buffer;
  IF _existing > 0 THEN RETURN false; END IF;
  SELECT count(*) INTO _existing FROM public.conversations
   WHERE vendor_id = _vendor_id AND id <> _conversation_id
     AND (status IN ('confirmed', 'completed') OR (status IN ('slot_held', 'awaiting_deposit') AND hold_expires_at > now()))
     AND (start_at AT TIME ZONE _tz)::date = (_start_at AT TIME ZONE _tz)::date;
  IF _existing >= _max_bookings THEN RETURN false; END IF;
  UPDATE public.conversations SET start_at = _start_at, end_at = _end_at, customer_name = _customer_name,
    customer_phone = _customer_phone, agreed_price = _agreed_price, total_price = _total_price,
    deposit_amount = _deposit_amount, hold_expires_at = CASE WHEN _deposit_amount > 0 THEN _hold_expires_at ELSE NULL END,
    status = CASE WHEN _deposit_amount > 0 THEN 'awaiting_deposit' ELSE 'confirmed' END,
    bucket = CASE WHEN _deposit_amount > 0 THEN 'needs_you' ELSE 'handled' END,
    updated_at = now() WHERE id = _conversation_id;
  RETURN true;
END;
$$;
COMMENT ON COLUMN public.wallets.balance IS 'US cents';
COMMENT ON COLUMN public.ai_usage.cost IS 'US cents';