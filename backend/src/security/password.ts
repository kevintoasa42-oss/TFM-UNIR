export type PasswordIterations = 100_000 | 310_000;
export const SITES_PASSWORD_ITERATIONS: PasswordIterations = 100_000;
const NODE_PASSWORD_ITERATIONS: PasswordIterations = 310_000;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): ArrayBuffer {
  return Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16)).buffer as ArrayBuffer;
}

async function derive(password: string, salt: string, iterations: PasswordIterations): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(salt), iterations, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(result));
}

export async function passwordRecord(password: string, iterations: PasswordIterations = NODE_PASSWORD_ITERATIONS): Promise<{ salt: string; hash: string }> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  // Production Workers cap PBKDF2 at 100,000; local workerd does not enforce it.
  // Store the work factor with each hash so different runtimes and old accounts remain readable.
  return { salt, hash: `pbkdf2-sha256$${iterations}$${await derive(password, salt, iterations)}` };
}

export async function passwordMatches(password: string, salt: string, expected: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(salt)) return false;
  const encoded = /^pbkdf2-sha256\$(100000|310000)\$([a-f0-9]{64})$/.exec(expected);
  // Untagged records were written with 310,000 iterations before the Sites fix.
  if (!encoded && !/^[a-f0-9]{64}$/.test(expected)) return false;
  const iterations = encoded ? Number(encoded[1]) as PasswordIterations : NODE_PASSWORD_ITERATIONS;
  const expectedHash = encoded?.[2] ?? expected;
  const actual = await derive(password, salt, iterations);
  if (actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return difference === 0;
}
