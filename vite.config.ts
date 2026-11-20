import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Mendengarkan di 0.0.0.0 (IPv4 127.0.0.1 dan IPv6 ::1 localhost)
    port: 5173,
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("@mantine/charts")) {
              return "charts";
            }
            if (id.includes("@mantine") || id.includes("mantine-datatable")) {
              return "mantine";
            }
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("lucide-react")) {
              return "icons";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
