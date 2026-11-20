-- ============================================================================
-- Migration 08: anon tidak boleh punya akses apa pun ke tabel di schema public
-- Jalankan setelah migrasi 01-07.
-- ============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
