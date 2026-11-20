-- ============================================================================
-- MIGRATION: 20261119000004_hardening.sql
-- DESCRIPTION: Peniadaan hard delete menu/addon, proteksi foreign key ON DELETE SET NULL,
--              penyempurnaan peta harga correct_order (filter NULL), dan
--              revisi fungsi get_best_selling_menu dengan validasi 366 hari & default 30 hari.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HAPUS POLICY DELETE MENU_PRODUCTS & MENU_ADDONS (Peniadaan Hard Delete)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "menu_products_delete_super_admin_only" ON public.menu_products;
DROP POLICY IF EXISTS "menu_addons_delete_super_admin_only" ON public.menu_addons;

-- Cabut izin DELETE sepenuhnya dari peran authenticated dan anon
REVOKE DELETE ON public.menu_products FROM authenticated, anon;
REVOKE DELETE ON public.menu_addons FROM authenticated, anon;

-- ----------------------------------------------------------------------------
-- 2. PASTIKAN FOREIGN KEY MEMAKAI ON DELETE SET NULL
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_menu_id_fkey' AND table_name = 'order_items'
  ) THEN
    ALTER TABLE public.order_items DROP CONSTRAINT order_items_menu_id_fkey;
  END IF;
  ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_menu_id_fkey
    FOREIGN KEY (menu_id) REFERENCES public.menu_products(id) ON DELETE SET NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_item_addons_addon_id_fkey' AND table_name = 'order_item_addons'
  ) THEN
    ALTER TABLE public.order_item_addons DROP CONSTRAINT order_item_addons_addon_id_fkey;
  END IF;
  ALTER TABLE public.order_item_addons
    ADD CONSTRAINT order_item_addons_addon_id_fkey
    FOREIGN KEY (addon_id) REFERENCES public.menu_addons(id) ON DELETE SET NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. PERBAIKAN CORRECT_ORDER: FILTER WHERE menu_id/addon_id IS NOT NULL
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
    v_store_id,
    p_order_id,
    'ORDER_CORRECTED',
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    v_old_snapshot,
    v_new_snapshot,
    trim(p_reason)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. VERSI BARU GET_BEST_SELLING_MENU (Validasi Rentang & Default 30 Hari)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_best_selling_menu(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_from date;
  v_to date;
  v_result jsonb;
BEGIN
  -- 1. Periksa Otentikasi
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  -- 2. Tentukan rentang tanggal: jika NULL, default 30 hari terakhir (Asia/Jakarta)
  v_to := COALESCE(p_to, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_from := COALESCE(p_from, v_to - 30);

  -- 3. Validasi urutan tanggal
  IF v_to < v_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh lebih awal dari tanggal awal' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Batasan rentang maksimal 366 hari
  IF (v_to - v_from) > 366 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal adalah 366 hari' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(b), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      oi.menu_id,
      oi.menu_name,
      sum(oi.quantity)::integer AS total_quantity,
      sum(oi.subtotal)::bigint AS total_sales
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.store_id = v_store_id
      AND o.status <> 'dibatalkan'
      AND o.day_key >= v_from
      AND o.day_key <= v_to
    GROUP BY oi.menu_id, oi.menu_name
    ORDER BY total_quantity DESC
    LIMIT 10
  ) b;

  RETURN v_result;
END;
$$;

-- Hak Akses Fungsi
REVOKE ALL ON FUNCTION public.get_best_selling_menu(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_best_selling_menu(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.correct_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_order(uuid, jsonb, text) TO authenticated;
