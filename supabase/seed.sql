-- ============================================================================
-- Supabase Master Seed: supabase/seed.sql
-- Warung Lontong Padang ("Lonpad Jauh") Master Data Seed
-- HANYA BERISI DATA MASTER TOKO, ADDON, PRODUK MENU, DAN RELASI ADDON
-- DAPAT DIJALANKAN DENGAN AMAN DI PRODUCTION & DEVELOPMENT
-- ============================================================================

-- 1. SEED STORE
INSERT INTO public.stores (
  id,
  name,
  currency,
  address,
  phone,
  timezone
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Lonpad Jauh',
  'IDR',
  'Jl. Mengger Hilir No.183, Sukapura, Kec. Dayeuhkolot, Kabupaten Bandung, Jawa Barat 40267',
  '082316321504',
  'Asia/Jakarta'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone;

-- 2. SEED MENU ADDONS
INSERT INTO public.menu_addons (id, store_id, name, price, is_active) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Telur Bulat Balado', 5000, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Perkedel Kentang', 5000, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Kerupuk', 2000, true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Gorengan', 1000, true)
ON CONFLICT (id) DO NOTHING;

-- 3. SEED MENU PRODUCTS
-- Lontong (Semua Rp 10.000)
INSERT INTO public.menu_products (id, store_id, name, category, price, available, is_active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Lontong Sayur Gulai Cubadak', 'Lontong', 10000, true, true),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Lontong Sayur Gulai Tauco', 'Lontong', 10000, true, true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Lontong Sayur Gulai Paku', 'Lontong', 10000, true, true),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Lontong Pical (Pecel)', 'Lontong', 10000, true, true),

  -- Tambahan
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Telur Bulat Balado', 'Tambahan', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'Perkedel Kentang', 'Tambahan', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'Kerupuk', 'Tambahan', 2000, true, true),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'Gorengan', 'Tambahan', 1000, true, true),

  -- Minuman Sachetan (Semua Rp 5.000)
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', 'Kopi Hitam Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'Kopi Susu Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Teh Tarik Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Nutrisari Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 'Milo Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 'Susu Jahe Sachet', 'Minuman', 5000, true, true),
  ('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 'Es Teh Manis', 'Minuman', 5000, true, true)
ON CONFLICT (id) DO NOTHING;

-- 4. LINK PRODUCT ADDONS (Hubungkan menu Lontong dengan addon utama)
INSERT INTO public.product_addons (product_id, addon_id)
SELECT p.id, a.id
FROM public.menu_products p
CROSS JOIN public.menu_addons a
WHERE p.category = 'Lontong'
ON CONFLICT (product_id, addon_id) DO NOTHING;
