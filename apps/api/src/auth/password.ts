import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * OpenDAoC game-account password hashing.
 *
 * Faithful port of the server's `CryptPassword`
 * (OpenDAoC-Core: GameServer/packets/Client/168/LoginRequestHandler.cs):
 *
 *   char[] pw = password.ToCharArray();
 *   byte[] res = new byte[pw.Length * 2];
 *   for (i) { res[i*2] = (byte)(pw[i] >> 8); res[i*2+1] = (byte)pw[i]; }  // UTF-16 big-endian
 *   byte[] hash = MD5.HashData(res);
 *   sb = "##"; foreach (b in hash) sb.Append(b.ToString("X"));            // uppercase hex, NO zero padding
 *
 * The `ToString("X")` format is the subtle part: each MD5 byte is rendered as
 * 1 OR 2 uppercase hex digits with NO leading-zero padding (0x0A -> "A",
 * 0x00 -> "0", 0xFF -> "FF"). Reproducing this exactly is required for the
 * live game server to accept a reset password.
 *
 * The server stores the result with a leading `##` and, on login, re-hashes
 * any stored password that does not already start with `##`.
 */
export function cryptGamePassword(password: string): string {
  const bytes = Buffer.alloc(password.length * 2);
  for (let i = 0; i < password.length; i += 1) {
    const code = password.charCodeAt(i);
    bytes[i * 2] = (code >> 8) & 0xff;
    bytes[i * 2 + 1] = code & 0xff;
  }

  const digest = createHash("md5").update(bytes).digest();

  let out = "##";
  for (const b of digest) {
    out += b.toString(16).toUpperCase(); // no padding — matches C# byte.ToString("X")
  }
  return out;
}

/** Constant-time comparison of a candidate password against a stored game hash. */
export function verifyGamePassword(candidate: string, stored: string): boolean {
  const expected = cryptGamePassword(candidate);
  const a = Buffer.from(expected);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Manager staff password hashing (this app's own users — NOT the game scheme).
// Uses Node's built-in scrypt (no native build step). Format:
//   scrypt$N$r$p$<saltB64>$<hashB64>
// ---------------------------------------------------------------------------
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

export function hashStaffPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyStaffPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64!, "base64");
  const expected = Buffer.from(hashB64!, "base64");
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
