ALTER TABLE public.conversations ADD COLUMN customer_access_hash text;
CREATE INDEX conversations_customer_access_hash_idx ON public.conversations (customer_access_hash) WHERE customer_access_hash IS NOT NULL;
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
  _existing integer;
BEGIN
  SELECT vendor_id INTO _vendor_id FROM public.conversations WHERE id = _conversation_id FOR UPDATE;
  IF _vendor_id IS NULL OR _start_at IS NULL OR _end_at <= _start_at OR _start_at <= now() THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_vendor_id::text));
  SELECT make_interval(mins => buffer_minutes), max_bookings_per_day INTO _buffer, _max_bookings FROM public.vendors WHERE id = _vendor_id;
  SELECT count(*) INTO _existing FROM public.conversations
   WHERE vendor_id = _vendor_id AND id <> _conversation_id
     AND (status IN ('confirmed', 'completed') OR (status IN ('slot_held', 'awaiting_deposit') AND hold_expires_at > now()))
     AND start_at < _end_at + _buffer AND end_at > _start_at - _buffer;
  IF _existing > 0 THEN RETURN false; END IF;
  SELECT count(*) INTO _existing FROM public.conversations
   WHERE vendor_id = _vendor_id AND id <> _conversation_id
     AND (status IN ('confirmed', 'completed') OR (status IN ('slot_held', 'awaiting_deposit') AND hold_expires_at > now()))
     AND (start_at AT TIME ZONE 'Africa/Lagos')::date = (_start_at AT TIME ZONE 'Africa/Lagos')::date;
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
REVOKE ALL ON FUNCTION public.hold_customer_slot_atomic(uuid,timestamptz,timestamptz,text,text,integer,integer,integer,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_customer_slot_atomic(uuid,timestamptz,timestamptz,text,text,integer,integer,integer,timestamptz) TO service_role;