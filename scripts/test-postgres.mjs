import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = `flashreto-check-${randomBytes(6).toString("hex")}`;
const directory = join(root, ".sites-runtime", "postgres-tests", project);
await mkdir(directory, { recursive: true });
async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
const webPort = await freePort();
let dbPort = await freePort();
while (dbPort === webPort) dbPort = await freePort();
const envFile = join(directory, "compose.env");
const record = join(directory, "record.json");
await writeFile(envFile, `POSTGRES_PASSWORD=${randomBytes(32).toString("hex")}\nPOSTGRES_PORT=${dbPort}\nFLASHRETO_PORT=${webPort}\n`, { mode: 0o600 });
const testEnv = { ...process.env, FLASHRETO_URL: `http://127.0.0.1:${webPort}`, FLASHRETO_TEST_RECORD: record };

function run(command, args, env = process.env) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? done() : reject(new Error(`${command} terminó con código ${code}`)));
  });
}
const compose = (...args) => run("docker", ["compose", "--project-name", project, "--env-file", envFile, "--file", "compose.yaml", ...args]);
try {
  await compose("up", "--build", "--detach", "--wait");
  await run(process.execPath, ["test/integration.mjs"], testEnv);
  await compose("down");
  await compose("up", "--detach", "--wait", "--no-build");
  await run(process.execPath, ["test/postgres-persistence.mjs"], testEnv);
} finally {
  // The generated project owns only disposable test volumes; the user's volume is a separate project.
  await compose("down", "--volumes");
}
