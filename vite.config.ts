import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUpstream = process.env.API_UPSTREAM ?? env.API_UPSTREAM ?? "http://127.0.0.1:4000";
  return {
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src/", import.meta.url)) } },
    server: { proxy: { "/api": { target: apiUpstream, ws: true, changeOrigin: false } } },
    preview: { proxy: { "/api": { target: apiUpstream, ws: true, changeOrigin: false } } },
  };
});
