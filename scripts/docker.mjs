import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const action = process.argv[2];
const actions = { up: ["up", "--build", "--detach", "--wait"], down: ["down"], logs: ["logs", "--tail", "100", "--follow"] };
if (!(action in actions)) throw new Error("Usa up, down o logs.");
const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = fileURLToPath(new URL("../.env.docker", import.meta.url));
if (!existsSync(envFile)) {
  writeFileSync(envFile, `POSTGRES_PASSWORD=${randomBytes(32).toString("hex")}\nPOSTGRES_PORT=5433\nFLASHRETO_PORT=3000\n`, { mode: 0o600, flag: "wx" });
}
const result = spawnSync("docker", ["compose", "--env-file", envFile, ...actions[action]], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
