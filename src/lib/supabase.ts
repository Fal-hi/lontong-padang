import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isDev = Boolean(import.meta.env.DEV);
export const isMockModeExplicit = import.meta.env.VITE_USE_MOCK === 'true';

// Mock mode is ONLY allowed in development AND with explicit VITE_USE_MOCK=true
export const isMockModeAllowed = isDev && isMockModeExplicit;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project') &&
    supabaseAnonKey !== 'your-anon-key-here',
);

// In production, or in dev without VITE_USE_MOCK=true, missing Supabase credentials blocks the app
export const isBlockingConfigError = !isSupabaseConfigured && !isMockModeAllowed;

// Fallback dummy credentials when .env is not yet configured by the user
const fallbackUrl = 'https://placeholder-project.supabase.co';
const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder';

export const supabase = createClient<Database>(
  isSupabaseConfigured ? (supabaseUrl as string) : fallbackUrl,
  isSupabaseConfigured ? (supabaseAnonKey as string) : fallbackKey,
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
);

// Expose client ke window hanya saat local development mode untuk kemudahan pengujian console
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { supabase: typeof supabase }).supabase = supabase;
}
