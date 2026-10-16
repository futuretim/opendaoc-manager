import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cryptGamePassword,
  hashStaffPassword,
  verifyGamePassword,
  verifyStaffPassword,
} from "./password.js";

/**
 * Independent re-implementation used ONLY in tests: derive the expected value a
 * different way (standard 32-char padded MD5 hex, then drop each byte's
 * high nibble when it is "0"). If this agrees with cryptGamePassword, the
 * no-padding `ToString("X")` behavior is correctly reproduced — without the
 * test simply mirroring the implementation's own loop.
 */
function cryptViaPaddedStrip(pw: string): string {
  const bytes = Buffer.alloc(pw.length * 2);
  for (let i = 0; i < pw.length; i += 1) {
    const c = pw.charCodeAt(i);
    bytes[i * 2] = (c >> 8) & 0xff;
    bytes[i * 2 + 1] = c & 0xff;
  }
  const hex = createHash("md5").update(bytes).digest("hex").toUpperCase(); // padded, 32 chars
  let s = "";
  for (let i = 0; i < hex.length; i += 2) {
    const hi = hex[i]!;
    const lo = hex[i + 1]!;
    s += (hi === "0" ? "" : hi) + lo;
  }
  return "##" + s;
}

describe("cryptGamePassword (OpenDAoC CryptPassword port)", () => {
  // Authoritative vectors computed from the exact algorithm; also independently
  // verified by cryptViaPaddedStrip below.
  const vectors: Record<string, string> = {
    "": "##D41D8CD98F0B24E980998ECF8427E",
    a: "##76F753576F2955B074758ACB4D5FA6",
    test123: "##70AB737140A38266C9D3BFC2AAE54AE",
    password: "##2BF323F1259B0C2F67E4302556BD72",
    "Abc!23": "##8EB9C57C4816E539104B2CE5BA3249A4",
  };

  it("matches known-good hashes", () => {
    for (const [input, expected] of Object.entries(vectors)) {
      expect(cryptGamePassword(input)).toBe(expected);
    }
  });

  it("agrees with an independent derivation (no-padding quirk)", () => {
    for (const input of [...Object.keys(vectors), "zzz", "0000", "Ä€"]) {
      expect(cryptGamePassword(input)).toBe(cryptViaPaddedStrip(input));
    }
  });

  it("always starts with ## and is uppercase hex", () => {
    const h = cryptGamePassword("whatever");
    expect(h.startsWith("##")).toBe(true);
    expect(h.slice(2)).toMatch(/^[0-9A-F]+$/);
  });

  it("is deterministic", () => {
    expect(cryptGamePassword("repeat")).toBe(cryptGamePassword("repeat"));
  });

  it("verifyGamePassword matches stored hashes", () => {
    const stored = cryptGamePassword("secret");
    expect(verifyGamePassword("secret", stored)).toBe(true);
    expect(verifyGamePassword("wrong", stored)).toBe(false);
  });
});

describe("staff password hashing (scrypt)", () => {
  it("round-trips and rejects wrong passwords", () => {
    const stored = hashStaffPassword("hunter2");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyStaffPassword("hunter2", stored)).toBe(true);
    expect(verifyStaffPassword("Hunter2", stored)).toBe(false);
  });

  it("uses a random salt (different hashes for same password)", () => {
    expect(hashStaffPassword("same")).not.toBe(hashStaffPassword("same"));
  });
});
