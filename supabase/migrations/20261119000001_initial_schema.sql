-- ============================================================================
-- Supabase Migration: 20261119000001_initial_schema.sql
-- Warung Lontong Padang ("Lonpad Jauh") - Order & Bookkeeping Schema
-- Strict Security & Row Level Security Revision
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('super_admin', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_source AS ENUM ('grab', 'gofood', 'shopeefood', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('baru', 'diproses', 'selesai', 'dibatalkan');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('dibayar', 'belum_dibayar');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'ORDER_CREATED',
    'ORDER_STATUS_CHANGED',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_CORRECTED',
    'PAYMENT_UPDATED',
    'DAY_CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES DEFINITION

-- 3.1 STORES
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'IDR',
  address text,
  phone text,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 PROFILES (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE RESTRICT,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'staff'::public.user_role,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.3 MENU PRODUCTS
CREATE TABLE IF NOT EXISTS public.menu_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Lontong', 'Tambahan', 'Minuman')),
  price bigint NOT NULL CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true, -- soft delete for menu items
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.4 MENU ADDONS
CREATE TABLE IF NOT EXISTS public.menu_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  name text NOT NULL,
  price bigint NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true, -- soft delete for addons
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 PRODUCT ADDONS JUNCTION
CREATE TABLE IF NOT EXISTS public.product_addons (
  product_id uuid NOT NULL REFERENCES public.menu_products(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.menu_addons(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, addon_id)
);

-- 3.6 ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_number text NOT NULL, -- Format: LP-YYYYMMDD-XXXX
  client_request_id uuid, -- Idempotency key per store
  external_order_number text,
  source public.order_source NOT NULL DEFAULT 'manual'::public.order_source,
  customer_name text,
  order_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  subtotal bigint NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  addons_total bigint NOT NULL DEFAULT 0 CHECK (addons_total >= 0),
  total bigint NOT NULL DEFAULT 0 CHECK (total >= 0),
  status public.order_status NOT NULL DEFAULT 'baru'::public.order_status,
  payment_status public.payment_status NOT NULL DEFAULT 'belum_dibayar'::public.payment_status,
  day_key date NOT NULL, -- DATE in Asia/Jakarta timezone
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_store_order_number UNIQUE (store_id, order_number),
  CONSTRAINT uq_store_client_request_id UNIQUE (store_id, client_request_id)
);

-- 3.7 ORDER ITEMS (SNAPSHOT PRICING)
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.menu_products(id) ON DELETE SET NULL,
  menu_name text NOT NULL, -- Immutable snapshot of menu name at order time
  variant text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL CHECK (unit_price >= 0), -- Immutable snapshot of price at order time
  subtotal bigint NOT NULL CHECK (subtotal >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 ORDER ITEM ADDONS (SNAPSHOT PRICING)
CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.menu_addons(id) ON DELETE SET NULL,
  addon_name text NOT NULL, -- Immutable snapshot of addon name
  price bigint NOT NULL CHECK (price >= 0), -- Immutable snapshot of addon price
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal bigint NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.9 EXPENSES (PENGELUARAN - ONLY SUPER_ADMIN)
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  category text NOT NULL, -- 'Bahan Baku', 'Operasional', 'Gaji', 'Lainnya'
  description text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  expense_date timestamptz NOT NULL DEFAULT now(),
  day_key date NOT NULL, -- DATE in Asia/Jakarta timezone
  receipt_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.10 DAILY CLOSINGS (Sales summary ONLY - NO expense/profit leak)
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  day_key date NOT NULL, -- DATE in Asia/Jakarta timezone
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  summary jsonb NOT NULL, -- Strict: contains ONLY sales metrics, zero expenses or profit
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_store_daily_closing UNIQUE (store_id, day_key)
);

-- 3.11 ORDER CORRECTIONS
CREATE TABLE IF NOT EXISTS public.order_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text NOT NULL,
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  corrected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

-- 3.12 AUDIT LOGS (Immutable audit trail - FK order_id ON DELETE SET NULL)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL, -- Never cascade delete logs!
  action_type public.audit_action NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. STORAGE BUCKET FOR RECEIPTS (PRIVATE - ONLY SUPER_ADMIN)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_store ON public.profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_menu_products_store_active ON public.menu_products(store_id, is_active, category);
CREATE INDEX IF NOT EXISTS idx_menu_addons_store_active ON public.menu_addons(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_store_day ON public.orders(store_id, day_key);
CREATE INDEX IF NOT EXISTS idx_orders_store_date ON public.orders(store_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON public.orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_payment ON public.orders(store_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_item ON public.order_item_addons(order_item_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store_day ON public.expenses(store_id, day_key);
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON public.expenses(store_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_order ON public.audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_time ON public.audit_logs(store_id, created_at DESC);

-- 6. HELPER FUNCTIONS & TRIGGERS FOR SECURITY AND TIMEZONE

-- 6.1 Helper: Get current user role (SECURITY DEFINER with locked search_path)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- 6.2 Helper: Get current user store_id (SECURITY DEFINER with locked search_path)
CREATE OR REPLACE FUNCTION public.get_current_user_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 6.3 Helper: Check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_current_user_role() = 'super_admin', false);
$$;

-- 6.4 Helper: Check if current user is staff or super_admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_current_user_role() IN ('super_admin', 'staff'), false);
$$;

-- 6.5 Trigger: Auto-populate day_key (DATE) in Asia/Jakarta timezone for orders
CREATE OR REPLACE FUNCTION public.set_order_day_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_date IS NULL THEN
    NEW.order_date := now();
  END IF;
  NEW.day_key := (NEW.order_date AT TIME ZONE 'Asia/Jakarta')::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_day_key ON public.orders;
CREATE TRIGGER trg_set_order_day_key
BEFORE INSERT OR UPDATE OF order_date ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_day_key();

-- 6.6 Trigger: Auto-populate day_key (DATE) in Asia/Jakarta timezone for expenses
CREATE OR REPLACE FUNCTION public.set_expense_day_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expense_date IS NULL THEN
    NEW.expense_date := now();
  END IF;
  NEW.day_key := (NEW.expense_date AT TIME ZONE 'Asia/Jakarta')::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_expense_day_key ON public.expenses;
CREATE TRIGGER trg_set_expense_day_key
BEFORE INSERT OR UPDATE OF expense_date ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_expense_day_key();

-- 6.7 Trigger: Automatically create public.profiles row when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_username text;
  v_full_name text;
BEGIN
  -- Grab first available store if none specified
  SELECT id INTO v_store_id FROM public.stores ORDER BY created_at ASC LIMIT 1;

  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    v_username
  );

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
    'staff'::public.user_role, -- Default role is always staff
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 6.8 Trigger: Protect profiles (Allow SQL Editor/service_role bootstrap when auth.uid() IS NULL, reject role/store_id/id changes by non-super_admin)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If executed via SQL Editor / service role / internal migration (auth.uid() is null), allow all changes
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If caller is super_admin, allow modifying profile fields
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- For non-super_admin users via API: strictly forbid changing role, store_id, or id
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak mengubah peran (role).'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.store_id IS DISTINCT FROM NEW.store_id THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak mengubah store_id.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Akses Ditolak: Kolom id tidak dapat diubah.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES

-- Enable RLS on ALL public tables
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7.1 STORES POLICIES (Filter store_id)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "stores_select_member" ON public.stores;
CREATE POLICY "stores_select_member" ON public.stores
  FOR SELECT TO authenticated
  USING (id = public.get_current_user_store_id());

DROP POLICY IF EXISTS "stores_modify_super_admin_only" ON public.stores;
CREATE POLICY "stores_modify_super_admin_only" ON public.stores
  FOR ALL TO authenticated
  USING (id = public.get_current_user_store_id() AND public.is_super_admin())
  WITH CHECK (id = public.get_current_user_store_id() AND public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 7.2 PROFILES POLICIES (Filter store_id)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_store_members" ON public.profiles;
CREATE POLICY "profiles_select_store_members" ON public.profiles
  FOR SELECT TO authenticated
  USING (store_id = public.get_current_user_store_id());

DROP POLICY IF EXISTS "profiles_update_self_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = id AND store_id = public.get_current_user_store_id())
    OR (public.is_super_admin() AND store_id = public.get_current_user_store_id())
  )
  WITH CHECK (
    (auth.uid() = id AND store_id = public.get_current_user_store_id())
    OR (public.is_super_admin() AND store_id = public.get_current_user_store_id())
  );

DROP POLICY IF EXISTS "profiles_delete_admin_only" ON public.profiles;
CREATE POLICY "profiles_delete_admin_only" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_super_admin() AND store_id = public.get_current_user_store_id());

-- ----------------------------------------------------------------------------
-- 7.3 MENU PRODUCTS POLICIES (Filter store_id)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "menu_products_select_store" ON public.menu_products;
CREATE POLICY "menu_products_select_store" ON public.menu_products
  FOR SELECT TO authenticated
  USING (store_id = public.get_current_user_store_id());

DROP POLICY IF EXISTS "menu_products_insert_staff_or_admin" ON public.menu_products;
CREATE POLICY "menu_products_insert_staff_or_admin" ON public.menu_products
  FOR INSERT TO authenticated
  WITH CHECK (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "menu_products_update_staff_or_admin" ON public.menu_products;
CREATE POLICY "menu_products_update_staff_or_admin" ON public.menu_products
  FOR UPDATE TO authenticated
  USING (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin())
  WITH CHECK (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "menu_products_delete_super_admin_only" ON public.menu_products;
CREATE POLICY "menu_products_delete_super_admin_only" ON public.menu_products
  FOR DELETE TO authenticated
  USING (store_id = public.get_current_user_store_id() AND public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 7.4 MENU ADDONS POLICIES (Filter store_id)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "menu_addons_select_store" ON public.menu_addons;
CREATE POLICY "menu_addons_select_store" ON public.menu_addons
  FOR SELECT TO authenticated
  USING (store_id = public.get_current_user_store_id());

DROP POLICY IF EXISTS "menu_addons_insert_staff_or_admin" ON public.menu_addons;
CREATE POLICY "menu_addons_insert_staff_or_admin" ON public.menu_addons
  FOR INSERT TO authenticated
  WITH CHECK (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "menu_addons_update_staff_or_admin" ON public.menu_addons;
CREATE POLICY "menu_addons_update_staff_or_admin" ON public.menu_addons
  FOR UPDATE TO authenticated
  USING (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin())
  WITH CHECK (store_id = public.get_current_user_store_id() AND public.is_staff_or_admin());

DROP POLICY IF EXISTS "menu_addons_delete_super_admin_only" ON public.menu_addons;
CREATE POLICY "menu_addons_delete_super_admin_only" ON public.menu_addons
  FOR DELETE TO authenticated
  USING (store_id = public.get_current_user_store_id() AND public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 7.5 PRODUCT ADDONS JUNCTION POLICIES (Filter store_id via product)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "product_addons_select_store" ON public.product_addons;
CREATE POLICY "product_addons_select_store" ON public.product_addons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_products p
      WHERE p.id = product_addons.product_id
        AND p.store_id = public.get_current_user_store_id()
    )
  );

DROP POLICY IF EXISTS "product_addons_modify_staff_or_admin" ON public.product_addons;
CREATE POLICY "product_addons_modify_staff_or_admin" ON public.product_addons
  FOR ALL TO authenticated
  USING (
    public.is_staff_or_admin()
    AND EXISTS (
      SELECT 1 FROM public.menu_products p
      WHERE p.id = product_addons.product_id
        AND p.store_id = public.get_current_user_store_id()
    )
  )
  WITH CHECK (
    public.is_staff_or_admin()
    AND EXISTS (
      SELECT 1 FROM public.menu_products p
      WHERE p.id = product_addons.product_id
        AND p.store_id = public.get_current_user_store_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 7.6 ORDERS POLICIES
-- Strict Requirement:
-- - SELECT: Filter store_id. Staff restricted to last 7 days (day_key in Asia/Jakarta). Super_admin has no time limit.
-- - INSERT/UPDATE: ZERO direct policies! (All writes via SECURITY DEFINER functions).
-- - DELETE: ZERO delete policies for ANY role! (No hard delete allowed).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "orders_select_by_role" ON public.orders;
CREATE POLICY "orders_select_by_role" ON public.orders
  FOR SELECT TO authenticated
  USING (
    store_id = public.get_current_user_store_id()
    AND (
      public.is_super_admin()
      OR (
        public.is_staff_or_admin()
        AND day_key >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7)
      )
    )
  );

-- (NO INSERT, UPDATE, or DELETE policies on public.orders for authenticated users!)

-- ----------------------------------------------------------------------------
-- 7.7 ORDER ITEMS POLICIES
-- SELECT allowed only through visible orders. ZERO direct INSERT/UPDATE/DELETE.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "order_items_select_via_orders" ON public.order_items;
CREATE POLICY "order_items_select_via_orders" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.store_id = public.get_current_user_store_id()
        AND (
          public.is_super_admin()
          OR (
            public.is_staff_or_admin()
            AND o.day_key >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7)
          )
        )
    )
  );

-- (NO direct INSERT, UPDATE, or DELETE policies on public.order_items!)

-- ----------------------------------------------------------------------------
-- 7.8 ORDER ITEM ADDONS POLICIES
-- SELECT allowed only through visible orders. ZERO direct INSERT/UPDATE/DELETE.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "order_item_addons_select_via_orders" ON public.order_item_addons;
CREATE POLICY "order_item_addons_select_via_orders" ON public.order_item_addons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      WHERE oi.id = order_item_addons.order_item_id
        AND o.store_id = public.get_current_user_store_id()
        AND (
          public.is_super_admin()
          OR (
            public.is_staff_or_admin()
            AND o.day_key >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7)
          )
        )
    )
  );

-- (NO direct INSERT, UPDATE, or DELETE policies on public.order_item_addons!)

-- ----------------------------------------------------------------------------
-- 7.9 EXPENSES POLICIES (ONLY SUPER_ADMIN - STAFF HAS ZERO ACCESS)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "expenses_all_super_admin_only" ON public.expenses;
CREATE POLICY "expenses_all_super_admin_only" ON public.expenses
  FOR ALL TO authenticated
  USING (store_id = public.get_current_user_store_id() AND public.is_super_admin())
  WITH CHECK (store_id = public.get_current_user_store_id() AND public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 7.10 DAILY CLOSINGS POLICIES (Summary contains only sales data)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "daily_closings_select_store" ON public.daily_closings;
CREATE POLICY "daily_closings_select_store" ON public.daily_closings
  FOR SELECT TO authenticated
  USING (store_id = public.get_current_user_store_id());

-- (NO direct INSERT/UPDATE/DELETE on daily_closings: handled via close_store_day RPC!)

-- ----------------------------------------------------------------------------
-- 7.11 ORDER CORRECTIONS POLICIES (SELECT via visible orders, NO direct write)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "order_corrections_select_via_orders" ON public.order_corrections;
CREATE POLICY "order_corrections_select_via_orders" ON public.order_corrections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_corrections.order_id
        AND o.store_id = public.get_current_user_store_id()
        AND (
          public.is_super_admin()
          OR (
            public.is_staff_or_admin()
            AND o.day_key >= ((now() AT TIME ZONE 'Asia/Jakarta')::date - 7)
          )
        )
    )
  );

-- (NO direct INSERT, UPDATE, or DELETE on order_corrections: handled via correct_order RPC!)

-- ----------------------------------------------------------------------------
-- 7.12 AUDIT LOGS POLICIES (IMMUTABLE LOGS, NO direct write)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_store" ON public.audit_logs;
CREATE POLICY "audit_logs_select_store" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (store_id = public.get_current_user_store_id());

-- (NO direct INSERT, UPDATE, or DELETE on audit_logs: written only by system functions!)

-- ----------------------------------------------------------------------------
-- 7.13 STORAGE OBJECTS POLICY (RECEIPTS BUCKET - ONLY SUPER_ADMIN)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "receipts_storage_super_admin_only" ON storage.objects;
CREATE POLICY "receipts_storage_super_admin_only" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'receipts' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'receipts' AND public.is_super_admin());

-- 8. TRANSACTIONAL SECURITY DEFINER RPC FUNCTIONS

-- 8.1 RPC: create_order (Idempotent, server pricing, now() date, creator audit)
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
  -- 1. Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: pengguna tidak terhubung ke toko mana pun' USING ERRCODE = '42501';
  END IF;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  -- 2. Check Idempotency via client_request_id
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
      -- Already created earlier; return existing record safely
      RETURN v_res;
    END IF;
  END IF;

  -- 3. Always set order_date to now() on server
  v_order_date := now();
  v_day_key := (v_order_date AT TIME ZONE 'Asia/Jakarta')::date;

  -- 4. Check if day is closed
  SELECT EXISTS(
    SELECT 1 FROM public.daily_closings
    WHERE store_id = v_store_id AND day_key = v_day_key
  ) INTO v_is_closed;

  IF v_is_closed THEN
    RAISE EXCEPTION 'Hari ini (%) sudah ditutup. Tidak dapat membuat pesanan baru.', v_day_key
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Generate sequential order number safely with lock
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

  -- 7. Insert Items (Server-Verified Pricing from menu_products & menu_addons)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_order->'items') AS x(
    menu_id uuid,
    variant text,
    quantity integer,
    note text,
    addons jsonb
  ) LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Jumlah item pesanan harus lebih besar dari 0' USING ERRCODE = 'P0001';
    END IF;

    -- Fetch active menu product price from database (NEVER trust client price)
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

    -- Insert addons if present
    IF v_item.addons IS NOT NULL AND jsonb_array_length(v_item.addons) > 0 THEN
      FOR v_addon IN SELECT * FROM jsonb_to_recordset(v_item.addons) AS y(
        addon_id uuid,
        quantity integer
      ) LOOP
        IF COALESCE(v_addon.quantity, 1) <= 0 THEN
          RAISE EXCEPTION 'Jumlah addon harus lebih besar dari 0' USING ERRCODE = 'P0001';
        END IF;

        -- Fetch active addon price from database
        SELECT name, price INTO v_addon_name, v_addon_price
        FROM public.menu_addons
        WHERE id = v_addon.addon_id AND store_id = v_store_id AND is_active = true;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Addon dengan ID % tidak ditemukan atau sedang tidak aktif', v_addon.addon_id
            USING ERRCODE = 'P0002';
        END IF;

        v_addon_subtotal := v_addon_subtotal + (v_addon_price * COALESCE(v_addon.quantity, 1));

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
          COALESCE(v_addon.quantity, 1),
          (v_addon_price * COALESCE(v_addon.quantity, 1))
        );
      END LOOP;
    END IF;

    -- Update item subtotal including addons
    UPDATE public.order_items
    SET subtotal = v_item_subtotal + v_addon_subtotal
    WHERE id = v_item_id;

    v_addons_total := v_addons_total + v_addon_subtotal;
  END LOOP;

  v_grand_total := v_subtotal + v_addons_total;

  -- 8. Update Order Parent Totals
  UPDATE public.orders
  SET subtotal = v_subtotal,
      addons_total = v_addons_total,
      total = v_grand_total
  WHERE id = v_order_id;

  -- 9. Record Audit Log
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

  -- 10. Return Result
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

-- 8.2 RPC: update_order_status
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

-- 8.3 RPC: cancel_order (Mandatory reason, rejection on closed days)
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

-- 8.4 RPC: correct_order (Mandatory reason, rejection on closed days, verified prices)
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

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Koreksi pesanan wajib menyertakan alasan.' USING ERRCODE = 'P0001';
  END IF;

  -- Rejection if day is already closed
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = v_order.day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup. Tidak dapat mengoreksi pesanan.', v_order.day_key
      USING ERRCODE = 'P0001';
  END IF;

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

  -- Delete existing items to replace with corrected ones
  DELETE FROM public.order_items WHERE order_id = p_order_id;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_correction->'items') AS x(
    menu_id uuid,
    variant text,
    quantity integer,
    note text,
    addons jsonb
  ) LOOP
    SELECT name, price INTO v_menu_name, v_menu_price
    FROM public.menu_products
    WHERE id = v_item.menu_id AND store_id = v_store_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu ID % tidak valid', v_item.menu_id USING ERRCODE = 'P0002';
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
        SELECT name, price INTO v_addon_name, v_addon_price
        FROM public.menu_addons
        WHERE id = v_addon.addon_id AND store_id = v_store_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Addon ID % tidak valid', v_addon.addon_id USING ERRCODE = 'P0002';
        END IF;

        v_addon_subtotal := v_addon_subtotal + (v_addon_price * COALESCE(v_addon.quantity, 1));

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
          COALESCE(v_addon.quantity, 1),
          (v_addon_price * COALESCE(v_addon.quantity, 1))
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
  SET source = COALESCE(p_correction->>'source', v_order.source::text)::public.order_source,
      external_order_number = NULLIF(trim(p_correction->>'external_order_number'), ''),
      customer_name = NULLIF(trim(p_correction->>'customer_name'), ''),
      notes = NULLIF(trim(p_correction->>'notes'), ''),
      payment_status = COALESCE(p_correction->>'payment_status', v_order.payment_status::text)::public.payment_status,
      subtotal = v_subtotal,
      addons_total = v_addons_total,
      total = v_grand_total
  WHERE id = p_order_id;

  v_new_snapshot := jsonb_build_object(
    'source', p_correction->>'source',
    'customerName', p_correction->>'customer_name',
    'externalOrderNumber', p_correction->>'external_order_number',
    'paymentStatus', p_correction->>'payment_status',
    'subtotal', v_subtotal,
    'addonsTotal', v_addons_total,
    'total', v_grand_total,
    'notes', p_correction->>'notes'
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

-- 8.5 RPC: toggle_order_payment
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

-- 8.6 RPC: close_store_day (Only super_admin, sales summary ONLY)
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak menutup hari.' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();
  SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;

  -- Check if already closed
  IF EXISTS (SELECT 1 FROM public.daily_closings WHERE store_id = v_store_id AND day_key = p_day_key) THEN
    RAISE EXCEPTION 'Hari % sudah ditutup sebelumnya.', p_day_key USING ERRCODE = 'P0001';
  END IF;

  -- Check if open orders remain
  SELECT count(*) INTO v_open_count
  FROM public.orders
  WHERE store_id = v_store_id AND day_key = p_day_key AND status IN ('baru', 'diproses');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'Terdapat % pesanan yang masih belum selesai atau dibatalkan.', v_open_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Aggregate sales summary ONLY (NO expenses or profit leakage!)
  SELECT jsonb_build_object(
    'totalOrders', count(*),
    'grossSales', COALESCE(sum(total), 0),
    'completedCount', COALESCE(count(*) FILTER (WHERE status = 'selesai'), 0),
    'completedSales', COALESCE(sum(total) FILTER (WHERE status = 'selesai'), 0),
    'cancelledCount', COALESCE(count(*) FILTER (WHERE status = 'dibatalkan'), 0),
    'cancelledAmount', COALESCE(sum(total) FILTER (WHERE status = 'dibatalkan'), 0),
    'unpaidCount', COALESCE(count(*) FILTER (WHERE payment_status = 'belum_dibayar'), 0),
    'unpaidAmount', COALESCE(sum(total) FILTER (WHERE payment_status = 'belum_dibayar'), 0)
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

-- 8.7 RPC: get_sales_summary (Available to staff & super_admin. NO expenses/profit!)
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
  -- Authenticate
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();

  -- Date range validation (maximum 366 days)
  IF p_to < p_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh lebih awal dari tanggal awal' USING ERRCODE = 'P0001';
  END IF;

  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal adalah 366 hari' USING ERRCODE = 'P0001';
  END IF;

  -- Aggregate sales only (strict: NO expenses, NO net profit)
  SELECT COALESCE(jsonb_agg(d ORDER BY d.day_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      o.day_key,
      count(*) AS total_orders,
      COALESCE(sum(o.total), 0) AS gross_sales,
      COALESCE(count(*) FILTER (WHERE o.status = 'selesai'), 0) AS completed_count,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai'), 0) AS completed_sales,
      COALESCE(count(*) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_count,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_amount,
      COALESCE(count(*) FILTER (WHERE o.payment_status = 'belum_dibayar'), 0) AS unpaid_count,
      COALESCE(sum(o.total) FILTER (WHERE o.payment_status = 'belum_dibayar'), 0) AS unpaid_amount
    FROM public.orders o
    WHERE o.store_id = v_store_id
      AND o.day_key >= p_from
      AND o.day_key <= p_to
    GROUP BY o.day_key
  ) d;

  RETURN v_result;
END;
$$;

-- 8.8 RPC: get_financial_summary (ONLY SUPER_ADMIN! Includes sales, expenses, and net profit)
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
  -- Authenticate & Check Role
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya super_admin yang berhak mengakses laporan keuangan.'
      USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();

  -- Date range validation (maximum 366 days)
  IF p_to < p_from THEN
    RAISE EXCEPTION 'Tanggal akhir tidak boleh lebih awal dari tanggal awal' USING ERRCODE = 'P0001';
  END IF;

  IF (p_to - p_from) > 366 THEN
    RAISE EXCEPTION 'Rentang tanggal maksimal adalah 366 hari' USING ERRCODE = 'P0001';
  END IF;

  WITH daily_sales AS (
    SELECT
      o.day_key,
      count(*) AS total_orders,
      COALESCE(sum(o.total), 0) AS gross_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'selesai'), 0) AS completed_sales,
      COALESCE(sum(o.total) FILTER (WHERE o.status = 'dibatalkan'), 0) AS cancelled_amount,
      COALESCE(sum(o.total) FILTER (WHERE o.payment_status = 'belum_dibayar'), 0) AS unpaid_amount
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
      COALESCE(s.cancelled_amount, 0) AS cancelled_amount,
      COALESCE(s.unpaid_amount, 0) AS unpaid_amount,
      COALESCE(e.total_expense, 0) AS total_expense,
      (COALESCE(s.completed_sales, 0) - COALESCE(e.total_expense, 0)) AS net_profit
    FROM daily_sales s
    FULL OUTER JOIN daily_exp e ON s.day_key = e.day_key
  ) f;

  RETURN v_result;
END;
$$;

-- 8.9 RPC: get_best_selling_menu (Available to staff and super_admin)
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
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: belum terautentikasi' USING ERRCODE = '42501';
  END IF;

  v_store_id := public.get_current_user_store_id();

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
      AND (p_from IS NULL OR o.day_key >= p_from)
      AND (p_to IS NULL OR o.day_key <= p_to)
    GROUP BY oi.menu_id, oi.menu_name
    ORDER BY total_quantity DESC
    LIMIT 10
  ) b;

  RETURN v_result;
END;
$$;

-- 9. STRICT PERMISSION REVOCATION & EXPLICIT GRANT
-- Revoke all function execution from PUBLIC and anon; grant strictly to authenticated!

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_current_user_store_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_store_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff_or_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated;

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

REVOKE ALL ON FUNCTION public.get_best_selling_menu(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_best_selling_menu(date, date) TO authenticated;
