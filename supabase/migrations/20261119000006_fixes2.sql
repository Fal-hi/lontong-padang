-- ============================================================================
-- Supabase Migration: 20261119000006_fixes2.sql
-- Warung Lontong Padang ("Lonpad Jauh") - Fixes Batch 2:
-- 1. Advisory lock pada update_order_status, cancel_order, correct_order, toggle_order_payment
-- 2. Larangan transisi mundur status pesanan (diproses -> baru)
-- 3. Fungsi baru reopen_store_day (hanya super_admin, alasan wajib, audit log DAY_REOPENED)
-- 4. Penguatan toggle_order_payment: hari tutup ditolak untuk staff, diizinkan untuk super_admin dengan alasan wajib
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC: update_order_status (Advisory Lock, Tolak Mundur diproses -> baru)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text DEFAULT NULL
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
  v_action public.audit_action;
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

  -- Staff hanya boleh memodifikasi pesanan hari ini (Asia/Jakarta)
  IF NOT public.is_super_admin() THEN
    IF v_order.day_key <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
      RAISE EXCEPTION 'Akses Ditolak: Staff hanya dapat mengubah status pesanan pada hari ini (%). Pesanan tanggal % hanya dapat diubah oleh super_admin.',
        (now() AT TIME ZONE 'Asia/Jakarta')::date, v_order.day_key
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_order.status = p_status THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Status sudah sama');
  END IF;

  -- Rejection jika hari sudah ditutup
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat mengubah status pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- Final state check
  IF v_order.status IN ('selesai', 'dibatalkan') THEN
    RAISE EXCEPTION 'Pesanan selesai atau dibatalkan bersifat final. Gunakan fungsi koreksi.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Tolak transisi mundur dari diproses ke baru
  IF v_order.status = 'diproses' AND p_status = 'baru' THEN
    RAISE EXCEPTION 'Transisi status mundur dari diproses ke baru tidak diizinkan.' USING ERRCODE = '22023';
  END IF;

  -- Cancel transition harus dipanggil lewat cancel_order dengan alasan
  IF p_status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Pembatalan pesanan harus melalui fungsi cancel_order dengan menyertakan alasan.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET status = p_status,
      completed_at = CASE WHEN p_status = 'selesai' THEN now() ELSE completed_at END
  WHERE id = p_order_id;

  v_action := CASE
    WHEN p_status = 'selesai' THEN 'ORDER_COMPLETED'::public.audit_action
    ELSE 'ORDER_STATUS_CHANGED'::public.audit_action
  END;

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
    v_action,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    to_jsonb(v_order.status),
    to_jsonb(p_status),
    NULLIF(trim(p_reason), '')
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, public.order_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, public.order_status, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. RPC: cancel_order (Advisory Lock)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. RPC: toggle_order_payment (Advisory Lock, Staff Ditolak Saat Tutup, Super Admin Boleh dgn Alasan)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_order_payment(
  p_order_id uuid,
  p_reason text DEFAULT NULL
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
  v_next public.payment_status;
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

  -- Pesanan yang dibatalkan tidak boleh diubah status pembayarannya (semua peran)
  IF v_order.status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Pesanan yang dibatalkan tidak dapat diubah status pembayarannya'
      USING ERRCODE = 'P0001';
  END IF;

  -- Staff hanya boleh memodifikasi pesanan hari ini (Asia/Jakarta)
  IF NOT public.is_super_admin() THEN
    IF v_order.day_key <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
      RAISE EXCEPTION 'Akses Ditolak: Staff hanya dapat mengubah status pembayaran pesanan pada hari ini (%). Pesanan tanggal % hanya dapat diubah oleh super_admin.',
        (now() AT TIME ZONE 'Asia/Jakarta')::date, v_order.day_key
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Jika hari pesanan sudah ada di daily_closings:
  -- Tolak untuk staff. Izinkan super_admin dengan alasan wajib.
  IF EXISTS (
    SELECT 1 FROM public.daily_closings
    WHERE store_id = v_order.store_id AND day_key = v_order.day_key
  ) THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Hari pesanan (%) telah ditutup. Status pembayaran tidak dapat diubah oleh staff.', v_order.day_key
        USING ERRCODE = '22023';
    ELSE
      IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Perubahan status pembayaran pada hari yang sudah ditutup wajib menyertakan alasan.'
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  v_next := CASE WHEN v_order.payment_status = 'dibayar' THEN 'belum_dibayar' ELSE 'dibayar' END;

  UPDATE public.orders
  SET payment_status = v_next
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
    'PAYMENT_UPDATED'::public.audit_action,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    to_jsonb(v_order.payment_status),
    to_jsonb(v_next),
    NULLIF(trim(p_reason), '')
  );

  RETURN jsonb_build_object('ok', true, 'paymentStatus', v_next);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_order_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_order_payment(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. RPC: correct_order (Advisory Lock)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.correct_order(
  p_order_id uuid,
  p_correction jsonb,
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
  v_item record;
  v_addon record;
  v_item_id uuid;
  v_menu_name text;
  v_menu_price bigint;
  v_addon_name text;
  v_addon_price bigint;
  v_item_subtotal bigint;
  v_addon_subtotal bigint;
  v_addons_total bigint := 0;
  v_subtotal bigint := 0;
  v_grand_total bigint := 0;
  v_old_snapshot jsonb;
  v_new_snapshot jsonb;
  v_old_items_map jsonb;
  v_old_addons_map jsonb;
  v_source public.order_source;
  v_customer_name text;
  v_external_order_number text;
  v_notes text;
  v_payment_status public.payment_status;
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

  -- Staff hanya boleh mengoreksi pesanan hari ini (Asia/Jakarta)
  IF NOT public.is_super_admin() THEN
    IF v_order.day_key <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
      RAISE EXCEPTION 'Akses Ditolak: Staff hanya dapat mengoreksi pesanan pada hari ini (%). Pesanan tanggal % hanya dapat dikoreksi oleh super_admin.',
        (now() AT TIME ZONE 'Asia/Jakarta')::date, v_order.day_key
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Koreksi pesanan wajib menyertakan alasan.' USING ERRCODE = 'P0001';
  END IF;

  -- Rejection jika hari sudah ditutup
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat mengoreksi pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- Tolak items yang bukan array atau kosong
  IF p_correction->'items' IS NULL OR jsonb_typeof(p_correction->'items') <> 'array' OR jsonb_array_length(p_correction->'items') = 0 THEN
    RAISE EXCEPTION 'Items pesanan wajib berupa array dan tidak boleh kosong.' USING ERRCODE = '22023';
  END IF;

  -- Penyusunan peta harga lama: Filter ketat WHERE menu_id/addon_id IS NOT NULL untuk menghindari null key
  SELECT jsonb_object_agg(oi.menu_id::text, jsonb_build_object('price', oi.unit_price, 'name', oi.menu_name))
  INTO v_old_items_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id AND oi.menu_id IS NOT NULL;

  SELECT jsonb_object_agg(oia.addon_id::text, jsonb_build_object('price', oia.price, 'name', oia.addon_name))
  INTO v_old_addons_map
  FROM public.order_item_addons oia
  JOIN public.order_items oi ON oia.order_item_id = oi.id
  WHERE oi.order_id = p_order_id AND oia.addon_id IS NOT NULL;

  v_old_items_map := COALESCE(v_old_items_map, '{}'::jsonb);
  v_old_addons_map := COALESCE(v_old_addons_map, '{}'::jsonb);

  v_old_snapshot := jsonb_build_object(
    'source', v_order.source,
    'customerName', v_order.customer_name,
    'externalOrderNumber', v_order.external_order_number,
    'paymentStatus', v_order.payment_status,
    'subtotal', v_order.subtotal,
    'addonsTotal', v_order.addons_total,
    'total', v_order.total,
    'notes', v_order.notes
  );

  -- Hapus item lama untuk digantikan item hasil koreksi
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_correction->'items') AS x(
    menu_id uuid,
    variant text,
    quantity integer,
    note text,
    addons jsonb
  ) LOOP
    IF v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 1000 THEN
      RAISE EXCEPTION 'Jumlah item (quantity) harus di antara 1 dan 1000.' USING ERRCODE = '22023';
    END IF;

    -- Pertahankan unit_price lama jika menu sudah ada di pesanan lama, jika baru ambil dari master menu_products
    IF v_old_items_map ? v_item.menu_id::text THEN
      v_menu_price := (v_old_items_map->v_item.menu_id::text->>'price')::bigint;
      v_menu_name := v_old_items_map->v_item.menu_id::text->>'name';
    ELSE
      SELECT name, price INTO v_menu_name, v_menu_price
      FROM public.menu_products
      WHERE id = v_item.menu_id AND store_id = v_store_id AND is_active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Menu ID % tidak valid atau tidak aktif', v_item.menu_id USING ERRCODE = 'P0002';
      END IF;
    END IF;

    v_item_id := gen_random_uuid();
    v_addon_subtotal := 0;
    v_item_subtotal := (v_menu_price * v_item.quantity);
    v_subtotal := v_subtotal + v_item_subtotal;

    INSERT INTO public.order_items (
      id,
      order_id,
      menu_id,
      menu_name,
      variant,
      quantity,
      unit_price,
      subtotal,
      note
    ) VALUES (
      v_item_id,
      p_order_id,
      v_item.menu_id,
      v_menu_name,
      v_item.variant,
      v_item.quantity,
      v_menu_price,
      v_item_subtotal,
      v_item.note
    );

    IF v_item.addons IS NOT NULL AND jsonb_array_length(v_item.addons) > 0 THEN
      FOR v_addon IN SELECT * FROM jsonb_to_recordset(v_item.addons) AS y(
        addon_id uuid,
        quantity integer
      ) LOOP
        IF v_addon.quantity IS NULL OR v_addon.quantity < 1 OR v_addon.quantity > 1000 THEN
          RAISE EXCEPTION 'Jumlah addon (quantity) harus di antara 1 dan 1000.' USING ERRCODE = '22023';
        END IF;

        IF v_old_addons_map ? v_addon.addon_id::text THEN
          v_addon_price := (v_old_addons_map->v_addon.addon_id::text->>'price')::bigint;
          v_addon_name := v_old_addons_map->v_addon.addon_id::text->>'name';
        ELSE
          SELECT name, price INTO v_addon_name, v_addon_price
          FROM public.menu_addons
          WHERE id = v_addon.addon_id AND store_id = v_store_id AND is_active = true;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Addon ID % tidak valid atau tidak aktif', v_addon.addon_id USING ERRCODE = 'P0002';
          END IF;
        END IF;

        v_addon_subtotal := v_addon_subtotal + (v_addon_price * v_addon.quantity);

        INSERT INTO public.order_item_addons (
          order_item_id,
          addon_id,
          addon_name,
          price,
          quantity,
          subtotal
        ) VALUES (
          v_item_id,
          v_addon.addon_id,
          v_addon_name,
          v_addon_price,
          v_addon.quantity,
          (v_addon_price * v_addon.quantity)
        );
      END LOOP;
    END IF;

    UPDATE public.order_items
    SET subtotal = v_item_subtotal + v_addon_subtotal
    WHERE id = v_item_id;

    v_addons_total := v_addons_total + v_addon_subtotal;
  END LOOP;

  v_grand_total := v_subtotal + v_addons_total;

  v_source := CASE WHEN p_correction ? 'source' THEN (p_correction->>'source')::public.order_source ELSE v_order.source END;
  v_customer_name := CASE WHEN p_correction ? 'customer_name' THEN NULLIF(trim(p_correction->>'customer_name'), '') ELSE v_order.customer_name END;
  v_external_order_number := CASE WHEN p_correction ? 'external_order_number' THEN NULLIF(trim(p_correction->>'external_order_number'), '') ELSE v_order.external_order_number END;
  v_notes := CASE WHEN p_correction ? 'notes' THEN NULLIF(trim(p_correction->>'notes'), '') ELSE v_order.notes END;
  v_payment_status := CASE WHEN p_correction ? 'payment_status' THEN (p_correction->>'payment_status')::public.payment_status ELSE v_order.payment_status END;

  UPDATE public.orders
  SET source = v_source,
      customer_name = v_customer_name,
      external_order_number = v_external_order_number,
      notes = v_notes,
      payment_status = v_payment_status,
      subtotal = v_subtotal,
      addons_total = v_addons_total,
      total = v_grand_total
  WHERE id = p_order_id;

  v_new_snapshot := jsonb_build_object(
    'source', v_source,
    'customerName', v_customer_name,
    'externalOrderNumber', v_external_order_number,
    'paymentStatus', v_payment_status,
    'subtotal', v_subtotal,
    'addonsTotal', v_addons_total,
    'total', v_grand_total,
    'notes', v_notes
  );

  INSERT INTO public.order_corrections (
    order_id,
    reason,
    old_value,
    new_value,
    corrected_by
  ) VALUES (
    p_order_id,
    trim(p_reason),
    v_old_snapshot,
    v_new_snapshot,
    v_user_id
  );

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
    'ORDER_CORRECTED'::public.audit_action,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    v_old_snapshot,
    v_new_snapshot,
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'subtotal', v_subtotal,
    'addonsTotal', v_addons_total,
    'total', v_grand_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_order(uuid, jsonb, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC: reopen_store_day (Super Admin Only, Alasan Wajib, Advisory Lock, Audit DAY_REOPENED)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_store_day(
  p_day_key date,
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
  v_old_summary jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak membuka kembali hari yang sudah ditutup.' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Pembukaan kembali hari yang sudah ditutup wajib menyertakan alasan.' USING ERRCODE = '22023';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  -- Advisory lock per store di awal
  PERFORM pg_advisory_xact_lock(hashtext(v_store_id::text));

  SELECT summary INTO v_old_summary
  FROM public.daily_closings
  WHERE store_id = v_store_id AND day_key = p_day_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hari % belum ditutup atau tidak ditemukan di daftar penutupan.', p_day_key USING ERRCODE = 'P0002';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  -- Hapus baris penutupan hari tersebut
  DELETE FROM public.daily_closings
  WHERE store_id = v_store_id AND day_key = p_day_key;

  -- Catat ke audit_logs dengan old_value = summary penutupan lama
  INSERT INTO public.audit_logs (
    store_id,
    action_type,
    user_id,
    user_name,
    old_value,
    new_value,
    reason
  ) VALUES (
    v_store_id,
    'DAY_REOPENED'::public.audit_action,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    v_old_summary,
    jsonb_build_object('day_key', p_day_key, 'reopened_at', now()),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'dayKey', p_day_key,
    'message', 'Hari berhasil dibuka kembali'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_store_day(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_store_day(date, text) TO authenticated;
