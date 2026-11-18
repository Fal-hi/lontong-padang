import { create } from 'zustand';
import type {
  NavPage,
  OrderStatus,
  PaymentStatus,
  OrderSource,
  DateFilter,
} from '../types';

export interface OrderFilterState {
  search: string;
  date: DateFilter;
  source: OrderSource | 'all';
  status: OrderStatus | 'all';
  payment: PaymentStatus | 'all';
}

const defaultOrderFilters: OrderFilterState = {
  search: '',
  date: 'today',
  source: 'all',
  status: 'all',
  payment: 'all',
};

interface NavState {
  currentPage: NavPage;
  orderDetailId: string | null;
  isNewOrderOpen: boolean;
  orderFilters: OrderFilterState;
  navigate: (page: NavPage) => void;
  navigateWithOrderFilter: (filters: Partial<OrderFilterState>) => void;
  setOrderFilter: <K extends keyof OrderFilterState>(
    key: K,
    val: OrderFilterState[K],
  ) => void;
  resetOrderFilters: () => void;
  openOrderDetail: (id: string) => void;
  closeOrderDetail: () => void;
  openNewOrder: () => void;
  closeNewOrder: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentPage: 'dashboard',
  orderDetailId: null,
  isNewOrderOpen: false,
  orderFilters: defaultOrderFilters,
  navigate: (page) =>
    set({
      currentPage: page,
      orderDetailId: null,
      isNewOrderOpen: false,
    }),
  navigateWithOrderFilter: (filters) =>
    set((state) => ({
      currentPage: 'orders',
      orderDetailId: null,
      isNewOrderOpen: false,
      orderFilters: {
        ...state.orderFilters,
        ...filters,
      },
    })),
  setOrderFilter: (key, val) =>
    set((state) => ({
      orderFilters: {
        ...state.orderFilters,
        [key]: val,
      },
    })),
  resetOrderFilters: () =>
    set({
      orderFilters: defaultOrderFilters,
    }),
  openOrderDetail: (id) =>
    set({ currentPage: 'orders', orderDetailId: id, isNewOrderOpen: false }),
  closeOrderDetail: () => set({ orderDetailId: null }),
  openNewOrder: () =>
    set({ currentPage: 'orders', isNewOrderOpen: true, orderDetailId: null }),
  closeNewOrder: () => set({ isNewOrderOpen: false }),
}));
