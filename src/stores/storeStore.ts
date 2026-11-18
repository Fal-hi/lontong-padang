import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store } from '../types';
import { mockStore } from '../mock';

interface StoreState {
  store: Store;
  updateStore: (patch: Partial<Store>) => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      store: mockStore,
      updateStore: (patch) =>
        set((s) => ({ store: { ...s.store, ...patch } })),
    }),
    {
      name: 'ricebox-store',
      version: 3,
      migrate: () => ({ store: mockStore }),
    },
  ),
);
