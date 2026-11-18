import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundState {
  soundEnabled: boolean;
  toggleSound: () => boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set, get) => ({
      soundEnabled: true,
      toggleSound: () => {
        const next = !get().soundEnabled;
        set({ soundEnabled: next });
        return next;
      },
      setSoundEnabled: (enabled: boolean) => set({ soundEnabled: enabled }),
    }),
    {
      name: 'lontong-sound-settings',
    },
  ),
);
