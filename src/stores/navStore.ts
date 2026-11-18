import { create } from 'zustand';
import type { NavPage } from '../types';

interface NavState {
  currentPage: NavPage;
  orderDetailId: string | null;
  isNewOrderOpen: boolean;
  navigate: (page: NavPage) => void;
  openOrderDetail: (id: string) => void;
  closeOrderDetail: () => void;
  openNewOrder: () => void;
  closeNewOrder: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentPage: 'dashboard',
  orderDetailId: null,
  isNewOrderOpen: false,
  navigate: (page) =>
    set({ currentPage: page, orderDetailId: null, isNewOrderOpen: false }),
  openOrderDetail: (id) =>
    set({ currentPage: 'orders', orderDetailId: id, isNewOrderOpen: false }),
  closeOrderDetail: () => set({ orderDetailId: null }),
  openNewOrder: () =>
    set({ currentPage: 'orders', isNewOrderOpen: true, orderDetailId: null }),
  closeNewOrder: () => set({ isNewOrderOpen: false }),
}));
