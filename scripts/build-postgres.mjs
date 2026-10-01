import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build", "--config", "frontend/vite.config.ts"], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await build({
  absWorkingDir: root, entryPoints: ["backend/src/node-server.ts"], outfile: "backend/dist/server.mjs",
  bundle: true, platform: "node", target: "node24", format: "esm", external: ["pg", "ws"],
});
