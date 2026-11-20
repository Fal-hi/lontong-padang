import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { STORAGE_KEYS } from '../constants';
import { authService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,

      login: (user: User) => set({ isAuthenticated: true, user }),

      logout: () => {
        if (isSupabaseConfigured) {
          void authService.signOut();
        }
        set({ isAuthenticated: false, user: null });
      },

      checkSession: async () => {
        if (!isSupabaseConfigured) return;
        try {
          const user = await authService.getCurrentSessionUser();
          if (user) {
            set({ isAuthenticated: true, user });
          } else if (get().isAuthenticated) {
            // Keep existing persisted user if in offline/demo mode
          }
        } catch {
          // Keep offline state
        }
      },
    }),
    {
      name: STORAGE_KEYS.AUTH,
    },
  ),
);
