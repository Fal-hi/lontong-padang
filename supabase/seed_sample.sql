-- ============================================================================
-- Supabase Sample Data Seed: supabase/seed_sample.sql
-- PERINGATAN: JANGAN DIJALANKAN DI PRODUCTION (HANYA UNTUK PENGUJIAN LOKAL/STAGING)
-- Berisi pesanan contoh, item pesanan, addon, dan pengeluaran dummy untuk testing.
-- ============================================================================

-- Pastikan seed master (supabase/seed.sql) sudah dijalankan sebelum file ini!

-- 1. SAMPLE ORDERS FOR TESTING & REPORTS
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
  completed_at
) VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'LP-20261119-0001',
    'e0000000-0000-0000-0000-000000000001',
    'GR-AB123',
    'grab',
    'Andi Pratama',
    now() - interval '2 hours',
    'Kuah banyak',
    20000,
    7000,
    27000,
    'selesai',
    'dibayar',
    (now() AT TIME ZONE 'Asia/Jakarta')::date,
    now() - interval '1 hour'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'LP-20261119-0002',
    'e0000000-0000-0000-0000-000000000002',
    'GO-456XY',
    'gofood',
    'Siti Rahayu',
    now() - interval '1 hour',
    'Jangan terlalu pedas',
    10000,
    5000,
    15000,
    'diproses',
    'dibayar',
    (now() AT TIME ZONE 'Asia/Jakarta')::date,
    NULL
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'LP-20261119-0003',
    'e0000000-0000-0000-0000-000000000003',
    'MAN-9988',
    'manual',
    'Pak Budi (Makan di Tempat)',
    now() - interval '30 minutes',
    NULL,
    15000,
    0,
    15000,
    'baru',
    'belum_dibayar',
    (now() AT TIME ZONE 'Asia/Jakarta')::date,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 2. SAMPLE ORDER ITEMS (SNAPSHOT PRICING)
INSERT INTO public.order_items (
  id,
  order_id,
  menu_id,
  menu_name,
  quantity,
  unit_price,
  subtotal,
  note
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'Lontong Sayur Gulai Cubadak',
    2,
    10000,
    27000,
    'Kuah banjir'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'Lontong Sayur Gulai Tauco',
    1,
    10000,
    15000,
    NULL
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000004',
    'Lontong Pical (Pecel)',
    1,
    10000,
    10000,
    NULL
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000015',
    'Es Teh Manis',
    1,
    5000,
    5000,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- 3. SAMPLE ORDER ITEM ADDONS (SNAPSHOT PRICING)
INSERT INTO public.order_item_addons (
  id,
  order_item_id,
  addon_id,
  addon_name,
  price,
  quantity,
  subtotal
) VALUES
  (
    'f0000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Telur Bulat Balado',
    5000,
    1,
    5000
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'Kerupuk',
    2000,
    1,
    2000
  ),
  (
    'f0000000-0000-0000-0000-000000000003',
    'e1000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'Perkedel Kentang',
    5000,
    1,
    5000
  )
ON CONFLICT (id) DO NOTHING;

-- 4. SAMPLE EXPENSES (FOR SUPER_ADMIN FINANCIAL TESTING)
INSERT INTO public.expenses (
  id,
  store_id,
  category,
  description,
  amount,
  expense_date,
  day_key
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Bahan Baku',
    'Beli nangka muda, paku, tauco, dan rempah di Pasar',
    85000,
    now() - interval '4 hours',
    (now() AT TIME ZONE 'Asia/Jakarta')::date
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Operasional',
    'Gas Elpiji 3kg (2 tabung)',
    44000,
    now() - interval '3 hours',
    (now() AT TIME ZONE 'Asia/Jakarta')::date
  )
ON CONFLICT (id) DO NOTHING;
