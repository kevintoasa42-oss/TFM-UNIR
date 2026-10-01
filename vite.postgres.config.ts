import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./local-web/", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL("./dist-postgres/public/", import.meta.url)), emptyOutDir: true },
});
