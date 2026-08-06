import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    /** Allow the Docker service hostname so trader-frontend's Next.js fallback rewrite
        (which proxies internally via http://landing:5173) isn't rejected. */
    allowedHosts: ["landing", "localhost", "127.0.0.1"],
    /**
     * HMR OFF — this dev server also serves production traffic.
     *
     * With HMR on, every visitor's browser opens a WebSocket back to the dev
     * server. That socket has to survive Cloudflare and nginx, and when it
     * doesn't, Vite's client logs connection errors to the console and then
     * starts calling location.reload() to "recover" — which is the blank page
     * people were reporting. Nobody is editing files against a visitor's
     * session, so the socket buys nothing and costs exactly that.
     *
     * Consequence for deploys: a changed file no longer hot-reloads. Restart
     * the landing container to pick it up.
     */
    hmr: false,
  },
});
