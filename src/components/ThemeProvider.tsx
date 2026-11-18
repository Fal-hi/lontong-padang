import { MantineProvider, createTheme, colorsTuple } from '@mantine/core';
import { useThemeStore } from '../stores/themeStore';

const theme = createTheme({
  primaryColor: 'primary',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontWeight: '700',
  },
  colors: {
    // Primary green palette used across the app (matches Tailwind primary tokens)
    primary: colorsTuple([
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ]),
    secondary: colorsTuple([
      '#faf5ff',
      '#f3e8ff',
      '#e9d5ff',
      '#d8b4fe',
      '#c084fc',
      '#a855f7',
      '#7c3aed',
      '#6d28d9',
      '#5b21b6',
      '#4c1d95',
    ]),
    danger: colorsTuple([
      '#fef2f2',
      '#fee2e2',
      '#fecaca',
      '#fca5a5',
      '#f87171',
      '#ef4444',
      '#dc2626',
      '#b91c1c',
      '#991b1b',
      '#7f1d1d',
    ]),
    warning: colorsTuple([
      '#fffbeb',
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
      '#b45309',
      '#92400e',
      '#78350f',
    ]),
    info: colorsTuple([
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ]),
    success: colorsTuple([
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ]),
    emerald: colorsTuple([
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
    ]),
  },
  components: {
    Modal: {
      defaultProps: {
        centered: true,
        radius: 'lg',
        padding: 'md',
        overlayProps: { backgroundOpacity: 0.55 },
      },
    },
    Textarea: {
      defaultProps: { radius: 'md' },
    },
  },
});

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useThemeStore((s) => s.colorScheme);

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      {children}
    </MantineProvider>
  );
}
