ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT '';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';
CREATE TABLE public.account_plans (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_plans TO authenticated;
GRANT ALL ON public.account_plans TO service_role;
ALTER TABLE public.account_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account reads own plan" ON public.account_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account reads own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  kind text NOT NULL,
  amount integer NOT NULL,
  day date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_ledger_user_idx ON public.wallet_ledger (user_id, created_at DESC);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account reads own ledger" ON public.wallet_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  day date NOT NULL,
  replies integer NOT NULL DEFAULT 0,
  cost integer NOT NULL DEFAULT 0,
  charged_at timestamptz,
  UNIQUE (vendor_id, day)
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads usage" ON public.ai_usage FOR SELECT TO authenticated USING (public.owns_vendor(vendor_id));
CREATE OR REPLACE FUNCTION public.ai_reply_price()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 25
$$;
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance) VALUES (_user, 2000) ON CONFLICT (user_id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.wallet_ledger (user_id, kind, amount, note) VALUES (_user, 'topup', 2000, 'Welcome credit');
  END IF;
  INSERT INTO public.account_plans (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ai_can_reply(_vendor uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _bal integer;
  _pending integer;
BEGIN
  SELECT owner_id INTO _owner FROM public.vendors WHERE id = _vendor;
  IF _owner IS NULL THEN RETURN false; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _owner;
  SELECT coalesce(sum(u.cost), 0) INTO _pending FROM public.ai_usage u JOIN public.vendors v ON v.id = u.vendor_id WHERE v.owner_id = _owner AND u.charged_at IS NULL;
  RETURN coalesce(_bal, 0) - _pending >= public.ai_reply_price();
END;
$$;
REVOKE ALL ON FUNCTION public.ai_can_reply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_can_reply(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.record_ai_reply(_vendor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_usage (vendor_id, day, replies, cost)
  VALUES (_vendor, (now() AT TIME ZONE 'Africa/Lagos')::date, 1, public.ai_reply_price())
  ON CONFLICT (vendor_id, day) DO UPDATE SET replies = public.ai_usage.replies + 1, cost = public.ai_usage.cost + public.ai_reply_price();
END;
$$;
REVOKE ALL ON FUNCTION public.record_ai_reply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_reply(uuid) TO service_role;
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
  FOR r IN SELECT u.id, u.vendor_id, u.day, u.cost, u.replies, v.owner_id, v.business_name FROM public.ai_usage u JOIN public.vendors v ON v.id = u.vendor_id WHERE u.charged_at IS NULL AND u.day < (now() AT TIME ZONE 'Africa/Lagos')::date FOR UPDATE OF u
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
REVOKE ALL ON FUNCTION public.charge_daily_ai_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_daily_ai_usage() TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_business_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _count integer;
  _limit integer := 1;
BEGIN
  SELECT plan INTO _plan FROM public.account_plans WHERE user_id = NEW.owner_id;
  IF _plan = 'pro' THEN _limit := 3; END IF;
  SELECT count(*) INTO _count FROM public.vendors WHERE owner_id = NEW.owner_id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'BUSINESS_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vendors_business_limit BEFORE INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.enforce_business_limit();
INSERT INTO public.account_plans (user_id) SELECT DISTINCT owner_id FROM public.vendors ON CONFLICT DO NOTHING;
INSERT INTO public.wallets (user_id, balance) SELECT DISTINCT owner_id, 2000 FROM public.vendors ON CONFLICT DO NOTHING;
INSERT INTO public.wallet_ledger (user_id, kind, amount, note) SELECT DISTINCT owner_id, 'topup', 2000, 'Welcome credit' FROM public.vendors;