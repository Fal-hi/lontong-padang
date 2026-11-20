import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store } from '../types';
import { mockStore } from '../mock';
import { storeService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

interface StoreState {
  store: Store;
  updateStore: (patch: Partial<Store>) => void;
  syncStoreFromSupabase: () => Promise<void>;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      store: mockStore,

      syncStoreFromSupabase: async () => {
        if (!isSupabaseConfigured) return;
        try {
          const remoteStore = await storeService.fetchStore();
          if (remoteStore) {
            set({ store: remoteStore });
          }
        } catch {
          // Keep offline state
        }
      },

      updateStore: (patch) => {
        const currentStore = get().store;
        set((s) => ({ store: { ...s.store, ...patch } }));

        if (isSupabaseConfigured) {
          void storeService.updateStore(currentStore.id, patch);
        }
      },
    }),
    {
      name: 'ricebox-store',
      version: 3,
      migrate: () => ({ store: mockStore }),
    },
  ),
);
