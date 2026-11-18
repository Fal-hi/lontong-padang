import { MantineProvider, createTheme, colorsTuple } from '@mantine/core';
import { useThemeStore } from '../stores/themeStore';

const theme = createTheme({
  primaryColor: 'emerald',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: {
    fontWeight: '700',
  },
  colors: {
    // Mirrors Tailwind's emerald scale so Mantine tokens (e.g. "emerald.6")
    // match the brand green used across the app.
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
