-- ============================================================================
-- MIGRATION: 20261119000002_fixes.sql
-- DESCRIPTION: Perbaikan ketat keamanan transaksional, advisory lock, validasi input,
--              proteksi hari tutup & masa lampau, rekalkulasi finansial, dan audit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER UPDATED_AT (stores, profiles, menu_products, menu_addons, expenses)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_updated_at ON public.stores;
CREATE TRIGGER trg_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_products_updated_at ON public.menu_products;
CREATE TRIGGER trg_menu_products_updated_at
BEFORE UPDATE ON public.menu_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_menu_addons_updated_at ON public.menu_addons;
CREATE TRIGGER trg_menu_addons_updated_at
BEFORE UPDATE ON public.menu_addons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. EXPENSES: DEFAULT CREATED_BY DARI AUTH.UID()
-- ----------------------------------------------------------------------------
ALTER TABLE public.expenses ALTER COLUMN created_by SET DEFAULT auth.uid();

-- ----------------------------------------------------------------------------
-- 3. MENU_PRODUCTS: HANYA SUPER_ADMIN YANG BOLEH MENGUBAH KOLOM PRICE
--    Staff tetap boleh INSERT menu baru dan UPDATE kolom lain.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_menu_product_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_super_admin() THEN
      IF OLD.price IS DISTINCT FROM NEW.price THEN
        RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak mengubah harga produk menu.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_menu_product_price ON public.menu_products;
CREATE TRIGGER trg_protect_menu_product_price
BEFORE UPDATE ON public.menu_products
FOR EACH ROW EXECUTE FUNCTION public.protect_menu_product_price();

-- ----------------------------------------------------------------------------
-- 4. HANDLE NEW AUTH USER: USERNAME UNIK & ON CONFLICT RESOLUTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_base_username text;
  v_username text;
  v_full_name text;
  v_suffix text;
BEGIN
  -- Dapatkan store pertama yang tersedia jika belum disetel
  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at ASC LIMIT 1;

  v_base_username := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(NEW.email, '@', 1), ''),
    'user'
  );

  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
    v_base_username
  );

  v_username := v_base_username;

  -- Jika username sudah terpakai di profiles lain, tambahkan 4 karakter pertama UUID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username AND id <> NEW.id) THEN
    v_suffix := substring(replace(NEW.id::text, '-', '') from 1 for 4);
    v_username := v_base_username || '_' || v_suffix;
  END IF;

  -- Jika masih bentrok, tambahkan 8 karakter pertama UUID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username AND id <> NEW.id) THEN
    v_suffix := substring(replace(NEW.id::text, '-', '') from 1 for 8);
    v_username := v_base_username || '_' || v_suffix;
  END IF;

  INSERT INTO public.profiles (
    id,
    store_id,
    username,
    full_name,
    email,
    role,
    avatar_url
  ) VALUES (
    NEW.id,
    v_store_id,
    v_username,
    v_full_name,
    NEW.email,
    'staff'::public.user_role,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. AUDIT LOGS: GANTI POLICY SELECT (Super Admin semua, Staff maks 7 hari)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_store" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  store_id = public.get_current_user_store_id()
  AND (
    public.is_super_admin()
    OR created_at >= (now() - interval '7 days')
  )
);

-- ----------------------------------------------------------------------------
-- 6. REVOKE TABLE-LEVEL DML DARI AUTHENTICATED DAN ANON
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.order_item_addons FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.order_corrections FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.daily_closings FROM authenticated, anon;

-- ----------------------------------------------------------------------------
-- 7. REVISI FUNGSI RPC DENGAN ADVISORY LOCK & VALIDASI KETAT
-- ----------------------------------------------------------------------------

-- 7.1 RPC: create_order
CREATE OR REPLACE FUNCTION public.create_order(p_order jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_store_id uuid;
  v_client_request_id uuid;
  v_order_id uuid;
  v_order_date timestamptz;
  v_day_key date;
  v_order_number text;
  v_max_seq integer := 0;
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
  v_is_closed boolean;
  v_res jsonb;
BEGIN
  -- 1. Otentikasi Pemanggil
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  -- Requirement 1: Ambil advisory lock per store di awal sebelum idempotensi & nomor urut
  PERFORM pg_advisory_xact_lock(hashtext(v_store_id::text));

  -- Requirement 2: Tolak items yang bukan array atau kosong
  IF p_order->'items' IS NULL OR jsonb_typeof(p_order->'items') <> 'array' OR jsonb_array_length(p_order->'items') = 0 THEN
    RAISE EXCEPTION 'Items pesanan wajib berupa array dan tidak boleh kosong.' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  -- 2. Cek Idempotensi via client_request_id (di bawah naungan advisory lock)
  v_client_request_id := NULLIF(p_order->>'client_request_id', '')::uuid;
  IF v_client_request_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', o.id,
      'storeId', o.store_id,
      'orderNumber', o.order_number,
      'clientRequestId', o.client_request_id,
      'externalOrderNumber', o.external_order_number,
      'source', o.source,
      'customerName', o.customer_name,
      'orderDate', o.order_date,
      'notes', o.notes,
      'subtotal', o.subtotal,
      'addonsTotal', o.addons_total,
      'total', o.total,
      'status', o.status,
      'paymentStatus', o.payment_status,
      'createdAt', o.created_at,
      'createdBy', o.created_by,
      'dayKey', o.day_key
    ) INTO v_res
    FROM public.orders o
    WHERE o.store_id = v_store_id AND o.client_request_id = v_client_request_id;

    IF v_res IS NOT NULL THEN
      RETURN v_res;
    END IF;
  END IF;

  -- 3. Stempel order_date dengan waktu server
  v_order_date := now();
  v_day_key := (v_order_date AT TIME ZONE 'Asia/Jakarta')::date;

  -- 4. Validasi Penutupan Hari
  SELECT EXISTS(
    SELECT 1 FROM public.daily_closings
    WHERE store_id = v_store_id AND day_key = v_day_key
  ) INTO v_is_closed;

  IF v_is_closed THEN
    RAISE EXCEPTION 'Hari ini (%) sudah ditutup. Tidak dapat membuat pesanan baru.', v_day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Hitung nomor urut secara sekuensial aman (advisory lock aktif)
  SELECT COALESCE(MAX(
    NULLIF(split_part(order_number, '-', 3), '')::integer
  ), 0)
  INTO v_max_seq
  FROM public.orders
  WHERE store_id = v_store_id AND day_key = v_day_key;

  v_order_number := 'LP-' || to_char(v_day_key, 'YYYYMMDD') || '-' || lpad((v_max_seq + 1)::text, 4, '0');

  v_order_id := gen_random_uuid();

  -- 6. Insert Order Header
  INSERT INTO public.orders (
    id,
    store_id,
    order_number,
    client_request_id,
    external_order_number,
    source,
    customer_name,
    order_date,
    notes,
    subtotal,
    addons_total,
    total,
    status,
    payment_status,
    day_key,
    created_by
  ) VALUES (
    v_order_id,
    v_store_id,
    v_order_number,
    v_client_request_id,
    NULLIF(trim(p_order->>'external_order_number'), ''),
    COALESCE(p_order->>'source', 'manual')::public.order_source,
    NULLIF(trim(p_order->>'customer_name'), ''),
    v_order_date,
    NULLIF(trim(p_order->>'notes'), ''),
    0, 0, 0,
    'baru'::public.order_status,
    COALESCE(p_order->>'payment_status', 'belum_dibayar')::public.payment_status,
    v_day_key,
    v_user_id
  );

  -- 7. Insert Items (Harga server, validasi quantity 1..1000)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_order->'items') AS x(
    menu_id uuid,
    variant text,
    quantity integer,
    note text,
    addons jsonb
  ) LOOP
    IF v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 1000 THEN
      RAISE EXCEPTION 'Jumlah item (quantity) harus di antara 1 dan 1000.' USING ERRCODE = '22023';
    END IF;

    SELECT name, price INTO v_menu_name, v_menu_price
    FROM public.menu_products
    WHERE id = v_item.menu_id AND store_id = v_store_id AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu dengan ID % tidak ditemukan atau sedang tidak aktif', v_item.menu_id
        USING ERRCODE = 'P0002';
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
      v_order_id,
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

        SELECT name, price INTO v_addon_name, v_addon_price
        FROM public.menu_addons
        WHERE id = v_addon.addon_id AND store_id = v_store_id AND is_active = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Addon dengan ID % tidak ditemukan atau sedang tidak aktif', v_addon.addon_id
            USING ERRCODE = 'P0002';
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

  UPDATE public.orders
  SET subtotal = v_subtotal,
      addons_total = v_addons_total,
      total = v_grand_total
  WHERE id = v_order_id;

  INSERT INTO public.audit_logs (
    store_id,
    order_id,
    action_type,
    user_id,
    user_name,
    new_value
  ) VALUES (
    v_store_id,
    v_order_id,
    'ORDER_CREATED',
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    jsonb_build_object('order_number', v_order_number, 'total', v_grand_total)
  );

  SELECT jsonb_build_object(
    'id', o.id,
    'storeId', o.store_id,
    'orderNumber', o.order_number,
    'clientRequestId', o.client_request_id,
    'externalOrderNumber', o.external_order_number,
    'source', o.source,
    'customerName', o.customer_name,
    'orderDate', o.order_date,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'addonsTotal', o.addons_total,
    'total', o.total,
    'status', o.status,
    'paymentStatus', o.payment_status,
    'createdAt', o.created_at,
    'createdBy', o.created_by,
    'dayKey', o.day_key
  ) INTO v_res
  FROM public.orders o
  WHERE o.id = v_order_id;

  RETURN v_res;
END;
$$;

-- 7.2 RPC: update_order_status
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
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND store_id = v_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Requirement 4: Jika bukan super_admin, hanya boleh memodifikasi pesanan hari ini (Asia/Jakarta)
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

  -- Rejection if day is already closed
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat mengubah status pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- Final state check
  IF v_order.status IN ('selesai', 'dibatalkan') THEN
    RAISE EXCEPTION 'Pesanan selesai atau dibatalkan bersifat final. Gunakan fungsi koreksi.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Cancel transition must be called via cancel_order
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

-- 7.3 RPC: cancel_order
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
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND store_id = v_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Requirement 4: Staff hanya boleh membatalkan pesanan hari ini (Asia/Jakarta)
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

  -- Rejection if day is already closed
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
    'ORDER_CANCELLED',
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    to_jsonb(v_order.status),
    to_jsonb('dibatalkan'::public.order_status),
    trim(p_reason)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'dibatalkan');
END;
$$;

-- 7.4 RPC: toggle_order_payment
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
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND store_id = v_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'P0002';
  END IF;

  -- Requirement 4: Staff hanya boleh memodifikasi pesanan hari ini (Asia/Jakarta)
  IF NOT public.is_super_admin() THEN
    IF v_order.day_key <> (now() AT TIME ZONE 'Asia/Jakarta')::date THEN
      RAISE EXCEPTION 'Akses Ditolak: Staff hanya dapat mengubah status pembayaran pesanan pada hari ini (%). Pesanan tanggal % hanya dapat diubah oleh super_admin.',
        (now() AT TIME ZONE 'Asia/Jakarta')::date, v_order.day_key
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Requirement 3: Tolak jika hari pesanan sudah ada di daily_closings
  IF EXISTS (
    SELECT 1 FROM public.daily_closings
    WHERE store_id = v_order.store_id AND day_key = v_order.day_key
  ) THEN
    RAISE EXCEPTION 'Hari pesanan (%) telah ditutup. Status pembayaran tidak dapat diubah.', v_order.day_key
      USING ERRCODE = '22023';
  END IF;

  IF v_order.status = 'dibatalkan' THEN
    RAISE EXCEPTION 'Pesanan yang dibatalkan tidak dapat diubah status pembayarannya'
      USING ERRCODE = 'P0001';
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
    'PAYMENT_UPDATED',
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    to_jsonb(v_order.payment_status),
    to_jsonb(v_next),
    NULLIF(trim(p_reason), '')
  );

  RETURN jsonb_build_object('ok', true, 'paymentStatus', v_next);
END;
$$;

-- 7.5 RPC: correct_order
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

  -- Requirement 4: Staff hanya boleh mengoreksi pesanan hari ini (Asia/Jakarta)
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

  -- Rejection if day is already closed
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat mengoreksi pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- Requirement 2: Tolak items yang bukan array atau kosong
  IF p_correction->'items' IS NULL OR jsonb_typeof(p_correction->'items') <> 'array' OR jsonb_array_length(p_correction->'items') = 0 THEN
    RAISE EXCEPTION 'Items pesanan wajib berupa array dan tidak boleh kosong.' USING ERRCODE = '22023';
  END IF;

  -- Requirement 5: Simpan peta harga lama dari item dan addon sebelum menghapus item lama
  SELECT jsonb_object_agg(oi.menu_id::text, jsonb_build_object('price', oi.unit_price, 'name', oi.menu_name))
  INTO v_old_items_map
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  SELECT jsonb_object_agg(oia.addon_id::text, jsonb_build_object('price', oia.price, 'name', oia.addon_name))
  INTO v_old_addons_map
  FROM public.order_item_addons oia
  JOIN public.order_items oi ON oia.order_item_id = oi.id
  WHERE oi.order_id = p_order_id;

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
    -- Requirement 2: quantity item antara 1 dan 1000
    IF v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 1000 THEN
      RAISE EXCEPTION 'Jumlah item (quantity) harus di antara 1 dan 1000.' USING ERRCODE = '22023';
    END IF;

    -- Requirement 5: Jika menu_id sudah ada di pesanan lama, pertahankan unit_price lama; jika baru, ambil harga aktif
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
        -- Requirement 2: quantity addon antara 1 dan 1000
        IF v_addon.quantity IS NULL OR v_addon.quantity < 1 OR v_addon.quantity > 1000 THEN
          RAISE EXCEPTION 'Jumlah addon (quantity) harus di antara 1 dan 1000.' USING ERRCODE = '22023';
        END IF;

        -- Requirement 5: Jika addon_id sudah ada di pesanan lama, pertahankan price lama; jika baru, ambil harga aktif
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

  -- Requirement 5: Field hanya diubah jika key-nya ada di p_correction (operator ?), selain itu pakai nilai lama
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

-- 7.6 RPC: close_store_day
CREATE OR REPLACE FUNCTION public.close_store_day(p_day_key date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_store_id uuid;
  v_open_count integer;
  v_summary jsonb;
  v_today date;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak menutup hari.' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  -- Requirement 1: Advisory lock per store di awal
  PERFORM pg_advisory_xact_lock(hashtext(v_store_id::text));

  -- Requirement 6: Tolak p_day_key yang lebih besar dari hari ini (Asia/Jakarta)
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  IF p_day_key > v_today THEN
    RAISE EXCEPTION 'Tanggal penutupan buku (%) tidak boleh melebihi tanggal hari ini (%).',
      p_day_key, v_today
      USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = p_day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup sebelumnya.', p_day_key USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_open_count
  FROM public.orders
  WHERE store_id = v_store_id AND day_key = p_day_key AND status IN ('baru', 'diproses');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'Terdapat % pesanan yang masih belum selesai atau dibatalkan.', v_open_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Requirement 7: unpaid_count / unpaid_amount hanya untuk status <> 'dibatalkan'
  -- Sertakan completedSales (semua selesai) dan paidCompletedSales (selesai & dibayar)
  SELECT jsonb_build_object(
    'totalOrders', count(*),
    'grossSales', COALESCE(sum(total), 0),
    'completedCount', COALESCE(count(*) FILTER (WHERE status = 'selesai'), 0),
    'completedSales', COALESCE(sum(total) FILTER (WHERE status = 'selesai'), 0),
    'paidCompletedSales', COALESCE(sum(total) FILTER (WHERE status = 'selesai' AND payment_status = 'dibayar'), 0),
    'cancelledCount', COALESCE(count(*) FILTER (WHERE status = 'dibatalkan'), 0),
    'cancelledAmount', COALESCE(sum(total) FILTER (WHERE status = 'dibatalkan'), 0),
    'unpaidCount', COALESCE(count(*) FILTER (WHERE payment_status = 'belum_dibayar' AND status <> 'dibatalkan'), 0),
    'unpaidAmount', COALESCE(sum(total) FILTER (WHERE payment_status = 'belum_dibayar' AND status <> 'dibatalkan'), 0)
  ) INTO v_summary
  FROM public.orders
  WHERE store_id = v_store_id AND day_key = p_day_key;

  INSERT INTO public.daily_closings (
    store_id,
    day_key,
    closed_by,
    user_name,
    summary
  ) VALUES (
    v_store_id,
    p_day_key,
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    v_summary
  );

  INSERT INTO public.audit_logs (
    store_id,
    action_type,
    user_id,
    user_name,
    new_value
  ) VALUES (
    v_store_id,
    'DAY_CLOSED',
    v_user_id,
    COALESCE(v_user_name, 'Kasir'),
    v_summary
  );

  RETURN jsonb_build_object('ok', true, 'dayKey', p_day_key, 'summary', v_summary);
END;
$$;

-- 7.7 RPC: get_sales_summary (Staff & Super Admin)
CREATE OR REPLACE FUNCTION public.get_sales_summary(
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();

  IF p_to < p_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh lebih awal dari tanggal awal' USING ERRCODE = 'P0001';
  END IF;

  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal adalah 366 hari' USING ERRCODE = 'P0001';
  END IF;

  -- Requirement 7: unpaid_count/unpaid_amount status <> 'dibatalkan', sertakan completed_sales dan paid_completed_sales
  SELECT COALESCE(jsonb_agg(d ORDER BY d.day_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      o.day_key,
      count(*) AS total_orders,
      COALESCE(sum(o.total), 0) AS gross_sales,
      COALESCE(count(*) FILTER (WHERE o.status = 'selesai'), 0) AS completed_count,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai'), 0) AS completed_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai' AND o.payment_status = 'dibayar'), 0) AS paid_completed_sales,
      COALESCE(count(*) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_count,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_amount,
      COALESCE(count(*) FILTER (WHERE o.payment_status = 'belum_dibayar' AND o.status <> 'dibatalkan'), 0) AS unpaid_count,
      COALESCE(sum(o.total) FILTER (WHERE o.payment_status = 'belum_dibayar' AND o.status <> 'dibatalkan'), 0) AS unpaid_amount
    FROM public.orders o
    WHERE o.store_id = v_store_id
      AND o.day_key >= p_from
      AND o.day_key <= p_to
    GROUP BY o.day_key
  ) d;

  RETURN v_result;
END;
$$;

-- 7.8 RPC: get_financial_summary (Super Admin Only)
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak mengakses laporan keuangan.'
      USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();

  IF p_to < p_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh lebih awal dari tanggal awal' USING ERRCODE = 'P0001';
  END IF;

  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal adalah 366 hari' USING ERRCODE = 'P0001';
  END IF;

  -- Requirement 7:
  -- - unpaid_amount hanya dari status <> 'dibatalkan'
  -- - net_profit hanya dari pesanan selesai DAN dibayar dikurangi total pengeluaran
  -- - sertakan completed_sales dan paid_completed_sales agar keduanya tampil
  WITH daily_sales AS (
    SELECT
      o.day_key,
      count(*) AS total_orders,
      COALESCE(sum(o.total), 0) AS gross_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai'), 0) AS completed_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai' AND o.payment_status = 'dibayar'), 0) AS paid_completed_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_amount,
      COALESCE(sum(o.total) FILTER (WHERE o.payment_status = 'belum_dibayar' AND o.status <> 'dibatalkan'), 0) AS unpaid_amount
    FROM public.orders o
    WHERE o.store_id = v_store_id
      AND o.day_key >= p_from
      AND o.day_key <= p_to
    GROUP BY o.day_key
  ),
  daily_exp AS (
    SELECT
      e.day_key,
      COALESCE(sum(e.amount), 0) AS total_expense
    FROM public.expenses e
    WHERE e.store_id = v_store_id
      AND e.day_key >= p_from
      AND e.day_key <= p_to
    GROUP BY e.day_key
  )
  SELECT COALESCE(jsonb_agg(f ORDER BY f.day_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      COALESCE(s.day_key, e.day_key) AS day_key,
      COALESCE(s.total_orders, 0) AS total_orders,
      COALESCE(s.gross_sales, 0) AS gross_sales,
      COALESCE(s.completed_sales, 0) AS completed_sales,
      COALESCE(s.paid_completed_sales, 0) AS paid_completed_sales,
      COALESCE(s.cancelled_amount, 0) AS cancelled_amount,
      COALESCE(s.unpaid_amount, 0) AS unpaid_amount,
      COALESCE(e.total_expense, 0) AS total_expense,
      (COALESCE(s.paid_completed_sales, 0) - COALESCE(e.total_expense, 0)) AS net_profit
    FROM daily_sales s
    FULL OUTER JOIN daily_exp e ON s.day_key = e.day_key
  ) f;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. REVOKE & GRANT AKSES PADA FUNGSI
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, public.order_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, public.order_status, text) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.correct_order(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_order(uuid, jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_order_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_order_payment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.close_store_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_store_day(date) TO authenticated;

REVOKE ALL ON FUNCTION public.get_sales_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sales_summary(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.get_financial_summary(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.protect_menu_product_price() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
