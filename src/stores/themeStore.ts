import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../constants';

type ColorScheme = 'light' | 'dark';

interface ThemeState {
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

function applyColorScheme(scheme: ColorScheme) {
  if (scheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorScheme: 'light',
      toggleColorScheme: () =>
        set((state) => {
          const next = state.colorScheme === 'light' ? 'dark' : 'light';
          applyColorScheme(next);
          return { colorScheme: next };
        }),
      setColorScheme: (scheme) => {
        applyColorScheme(scheme);
        set({ colorScheme: scheme });
      },
    }),
    {
      name: STORAGE_KEYS.THEME,
      onRehydrateStorage: () => (state) => {
        if (state?.colorScheme) {
          applyColorScheme(state.colorScheme);
        }
      },
    },
  ),
);
