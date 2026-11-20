-- ============================================================================
-- MIGRATION: 20261119000003_audit_enum.sql
-- DESCRIPTION: Pengecekan dan pendaftaran nilai enum audit_action secara lengkap
--              dan idempoten pada PostgreSQL.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
    CREATE TYPE public.audit_action AS ENUM (
      'ORDER_CREATED',
      'ORDER_STATUS_CHANGED',
      'ORDER_COMPLETED',
      'ORDER_CANCELLED',
      'ORDER_CORRECTED',
      'PAYMENT_UPDATED',
      'DAY_CLOSED'
    );
  END IF;
END $$;

-- Pastikan seluruh nilai enum audit_action terdaftar (idempotent)
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_CREATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_STATUS_CHANGED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_COMPLETED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'ORDER_CORRECTED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'PAYMENT_UPDATED';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'DAY_CLOSED';
