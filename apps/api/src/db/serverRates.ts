// The global experience-rate modifier in OpenDAoC is the `xp_rate`
// ServerProperty (category "rates"): a double the server multiplies all
// earned XP by. 1.0 is normal rate, 2.0 is double XP, etc. We reuse the
// generic ServerProperty read/write plumbing but wrap it in a focused,
// validated endpoint so staff get a purpose-built control instead of a
// free-text cell.
export const XP_RATE_KEY = "xp_rate";

// A sane ceiling to guard against fat-fingered values; OpenDAoC itself
// imposes no hard cap, but a multiplier beyond this is almost certainly a
// typo and would wreck a live server.
export const MAX_XP_MULTIPLIER = 10000;

/**
 * Validate and normalize a user-supplied XP multiplier into the plain
 * decimal string OpenDAoC stores (and parses with invariant culture).
 * Returns null when the input is not a finite, non-negative number within
 * the allowed range.
 */
export function normalizeMultiplier(input: unknown): string | null {
  let n: number;
  if (typeof input === "number") {
    n = input;
  } else {
    // Number("") and Number("   ") both coerce to 0, which we must not treat
    // as a valid multiplier — reject blank input before parsing.
    const trimmed = String(input).trim();
    if (trimmed === "") return null;
    n = Number(trimmed);
  }
  if (!Number.isFinite(n) || n < 0 || n > MAX_XP_MULTIPLIER) return null;
  // `String(n)` already drops trailing zeros ("2.50" -> "2.5", "2.0" -> "2")
  // and never uses exponent notation for values in this range.
  return String(n);
}

/** Parse a stored property value into a number for display (NaN-safe). */
export function parseMultiplier(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
