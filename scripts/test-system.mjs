import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const backend = resolve(process.env.BACKEND_CONTEXT ?? join(root, "../TFM-BACK-END"));
const project = `flashreto-check-${randomBytes(6).toString("hex")}`;
const directory = join(root, ".sites-runtime", "separated-tests", project);
await mkdir(directory, { recursive: true });
const ports = new Set();
async function freePort() {
  for (;;) {
    const server = createServer();
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    await new Promise((done) => server.close(done));
    if (!ports.has(port)) { ports.add(port); return port; }
  }
}
const frontendPort = await freePort(), backendPort = await freePort(), dbPort = await freePort();
const envFile = join(directory, "compose.env"), record = join(directory, "record.json");
const env = {
  ...process.env, BACKEND_CONTEXT: backend,
  POSTGRES_PASSWORD: randomBytes(32).toString("hex"), POSTGRES_PORT: String(dbPort),
  BACKEND_PORT: String(backendPort), FLASHRETO_PORT: String(frontendPort), FLASHRETO_BIND: "127.0.0.1",
  API_UPSTREAM: "http://backend:4000",
  FLASHRETO_URL: `http://127.0.0.1:${frontendPort}`, FLASHRETO_FRONTEND_URL: `http://127.0.0.1:${frontendPort}`,
  FLASHRETO_TEST_RECORD: record,
};
await writeFile(envFile, "# Los valores de prueba se pasan por entorno, nunca se usa la contraseña del proyecto normal.\n", { mode: 0o600 });
function run(command, args, cwd = root) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? done() : reject(new Error(`${command} terminó con código ${code}`)));
  });
}
const compose = (...args) => run("docker", ["compose", "--project-name", project, "--env-file", envFile, "--file", "compose.yaml", ...args]);
try {
  await compose("up", "--build", "--detach", "--wait", "--wait-timeout", "180");
  const direct = await fetch(`http://127.0.0.1:${backendPort}/api/health`);
  if (!direct.ok) throw new Error("El backend independiente no está disponible.");
  const rootResponse = await fetch(`http://127.0.0.1:${backendPort}/`);
  if (rootResponse.status !== 404) throw new Error("El backend no debe servir las pantallas del frontend.");
  await run(process.execPath, ["test/integration.mjs"], backend);
  await compose("down");
  await compose("up", "--detach", "--wait", "--no-build", "--wait-timeout", "180");
  await run(process.execPath, ["test/postgres-persistence.mjs"], backend);
  await writeFile(join(directory, "result.json"), JSON.stringify({ project, frontendPort, backendPort, dbPort, passed: true }));
  console.log(`Tres contenedores verificados. Imagen frontend: ${project}-frontend; backend: ${project}-backend.`);
} finally {
  // This random project owns only test containers and its own disposable volume.
  await compose("down", "--volumes");
}
