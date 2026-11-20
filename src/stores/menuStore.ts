import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuAddon, MenuProduct } from '../types';
import { STORAGE_KEYS } from '../constants';
import { generateId } from '../utils';
import { mockAddons, mockMenu } from '../mock';
import { menuService } from '../services/supabaseService';
import { isSupabaseConfigured } from '../lib/supabase';

export interface NewProductInput {
  storeId: string;
  name: string;
  category: string;
  price: number;
  addonIds: string[];
}

interface MenuState {
  products: MenuProduct[];
  addons: MenuAddon[];
  addProduct: (input: NewProductInput) => void;
  toggleAvailable: (id: string) => void;
  toggleActive: (id: string) => void;
  syncMenuFromSupabase: () => Promise<void>;
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      products: mockMenu,
      addons: mockAddons,

      syncMenuFromSupabase: async () => {
        if (!isSupabaseConfigured) return;
        try {
          const [remoteAddons, remoteProducts] = await Promise.all([
            menuService.fetchAddons(),
            menuService.fetchProducts(),
          ]);
          if (remoteAddons.length > 0) set({ addons: remoteAddons });
          if (remoteProducts.length > 0) set({ products: remoteProducts });
        } catch {
          // Keep offline state
        }
      },

      addProduct: (input) => {
        const id = generateId();
        set((s) => ({
          products: [
            ...s.products,
            {
              id,
              storeId: input.storeId,
              name: input.name,
              category: input.category,
              price: input.price,
              addonIds: input.addonIds,
              available: true,
              active: true,
            },
          ],
        }));

        if (isSupabaseConfigured) {
          void menuService.addProduct(input).then((res) => {
            if (res.id) {
              set((s) => ({
                products: s.products.map((p) => (p.id === id ? { ...p, id: res.id as string } : p)),
              }));
            }
          });
        }
      },

      toggleAvailable: (id) => {
        const product = get().products.find((p) => p.id === id);
        if (!product) return;
        const current = product.available;

        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, available: !p.available } : p,
          ),
        }));

        if (isSupabaseConfigured) {
          void menuService.toggleAvailable(id, current);
        }
      },

      toggleActive: (id) => {
        const product = get().products.find((p) => p.id === id);
        if (!product) return;
        const current = product.active;

        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, active: !p.active } : p,
          ),
        }));

        if (isSupabaseConfigured) {
          void menuService.toggleActive(id, current);
        }
      },
    }),
    {
      name: STORAGE_KEYS.MENU,
      version: 3,
      migrate: () => ({ products: mockMenu, addons: mockAddons }),
    },
  ),
);
