function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): ArrayBuffer {
  return Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16)).buffer as ArrayBuffer;
}

async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(salt), iterations: 310_000, hash: "SHA-256" }, key, 256);
  return hex(new Uint8Array(result));
}

export async function passwordRecord(password: string): Promise<{ salt: string; hash: string }> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await derive(password, salt) };
}

export async function passwordMatches(password: string, salt: string, expected: string): Promise<boolean> {
  const actual = await derive(password, salt);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
