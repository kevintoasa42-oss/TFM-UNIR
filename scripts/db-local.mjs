import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const stateDirectory = process.env.FLASHRETO_DB_STATE ?? ".wrangler/state";
for (const migration of ["drizzle/0000_perfect_viper.sql", "drizzle/0001_optimal_sentinel.sql"]) {
  const result = spawnSync(process.execPath, [
    "--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js",
    "d1", "execute", "DB", "--local", "--file", migration,
    "--config", "dist/server/wrangler.json", "--persist-to", stateDirectory, "--yes",
  ], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
