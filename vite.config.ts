import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    // Menambahkan host ngrok ke allowedHosts
    allowedHosts: ["silas-convallariaceous-strophically.ngrok-free.dev"],
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [], // Menghapus '@tanstack/query-persist-client-core' dari daftar pengecualian
  },
}));