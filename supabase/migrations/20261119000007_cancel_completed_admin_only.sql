-- ============================================================================
-- Supabase Migration: 20261119000007_cancel_completed_admin_only.sql
-- Warung Lontong Padang ("Lonpad Jauh") - Restriksi Pembatalan Pesanan Selesai
-- Khusus pesanan berstatus 'selesai', pembatalan hanya diizinkan untuk super_admin.
-- Staff hanya diizinkan membatalkan pesanan berstatus 'baru' dan 'diproses' (pada hari ini).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_store_id uuid;
  v_order public.orders%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  -- Advisory lock per store di awal sebelum SELECT pesanan
  PERFORM pg_advisory_xact_lock(hashtext(v_store_id::text));

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND store_id = v_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Staff hanya boleh membatalkan pesanan hari ini (Asia/Jakarta)
  IF NOT public.is_super_admin() THEN
    IF v_order.day_key <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
      RAISE EXCEPTION 'Akses Ditolak: Staff hanya dapat membatalkan pesanan pada hari ini (%). Pesanan tanggal % hanya dapat dibatalkan oleh super_admin.',
        (now() AT TIME ZONE 'Asia/Jakarta')::date, v_order.day_key
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Restriksi Baru: Pesanan berstatus 'selesai' hanya dapat dibatalkan oleh super_admin
  IF v_order.status = 'selesai' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super admin yang dapat membatalkan pesanan selesai.'
      USING ERRCODE = '42501';
  END IF;

  IF v_order.status = 'dibatalkan' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Pesanan sudah berstatus dibatalkan');
  END IF;

  -- Rejection jika hari sudah ditutup
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat membatalkan pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Pembatalan pesanan wajib menyertakan alasan.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET status = 'dibatalkan'
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (
    store_id,
    order_id,
    action_type,
    user_id,
    user_name,
    old_value,
    new_value,
    reason
  ) VALUES (
    v_order.store_id,
    p_order_id,
    'ORDER_CANCELLED'::public.audit_action,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    to_jsonb(v_order.status),
    to_jsonb('dibatalkan'::public.order_status),
    trim(p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'dibatalkan');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;
