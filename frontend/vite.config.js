import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend origin used by the dev and preview proxies. Keeping the app on
// relative URLs by default means no hardcoded hostnames leak into the bundle;
// set VITE_API_BASE_URL to point at a deployed backend instead of using a proxy.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://127.0.0.1:5000";

const proxy = {
  "/api": {
    target: BACKEND_ORIGIN,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    port: 4173,
    proxy,
  },
});

