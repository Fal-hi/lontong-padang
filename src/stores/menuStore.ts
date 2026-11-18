import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuAddon, MenuProduct } from '../types';
import { STORAGE_KEYS } from '../constants';
import { generateId } from '../utils';
import { mockAddons, mockMenu } from '../mock';

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
}

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      products: mockMenu,
      addons: mockAddons,
      addProduct: (input) =>
        set((s) => ({
          products: [
            ...s.products,
            {
              id: generateId(),
              storeId: input.storeId,
              name: input.name,
              category: input.category,
              price: input.price,
              addonIds: input.addonIds,
              available: true,
              active: true,
            },
          ],
        })),
      toggleAvailable: (id) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, available: !p.available } : p,
          ),
        })),
      toggleActive: (id) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? { ...p, active: !p.active } : p,
          ),
        })),
    }),
    {
      name: STORAGE_KEYS.MENU,
      version: 3,
      migrate: () => ({ products: mockMenu, addons: mockAddons }),
    },
  ),
);
