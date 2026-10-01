import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./db/d1/migrations",
  schema: "./db/d1/schema.ts",
  dialect: "sqlite",
});
