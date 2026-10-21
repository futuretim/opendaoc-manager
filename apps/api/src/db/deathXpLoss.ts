// "XP loss on death" in OpenDAoC is gated by the `pve_exp_loss_level`
// ServerProperty (category "pve"): a byte giving the lowest character level
// at which a PvE death costs experience. The server only deducts XP when
// `Level >= PVE_EXP_LOSS_LEVEL` (see GamePlayer.Release in OpenDAoC-Core),
// so setting the threshold above the highest attainable level disables XP
// loss on death for every player. The server default is 6.
//
// We reuse the generic ServerProperty read/write plumbing but wrap it in a
// focused, validated endpoint that presents the setting as a simple
// enable/disable toggle (with an optional start level) rather than a raw
// numeric cell.
export const DEATH_XP_LOSS_KEY = "pve_exp_loss_level";

// The highest level a character can reach in normal DAoC play. A start level
// above this means no player ever meets the `Level >= threshold` condition,
// so XP loss is effectively off.
export const MAX_PLAYER_LEVEL = 50;

// The sentinel we store when XP loss is disabled. 255 is the max of the
// property's byte column and is unmistakably above any real character level,
// so the intent ("off") reads clearly in the raw DB and the audit log.
export const DISABLED_LEVEL = 255;

// OpenDAoC's own default start level, restored when loss is re-enabled
// without an explicit level.
export const DEFAULT_START_LEVEL = 6;

/** Parse a stored property value into a start level (NaN-safe, clamped byte). */
export function parseStartLevel(value: string): number {
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n)) return DEFAULT_START_LEVEL;
  if (n < 0) return 0;
  if (n > 255) return 255;
  return n;
}

/**
 * Is XP loss on death currently in effect? It is only disabled when the
 * threshold sits above the maximum attainable level; any start level a real
 * character can reach (1..MAX_PLAYER_LEVEL) means loss is enabled.
 */
export function isLossEnabled(startLevel: number): boolean {
  return startLevel <= MAX_PLAYER_LEVEL;
}

/**
 * Resolve the desired toggle state into the plain byte string OpenDAoC
 * stores. Disabling always writes the sentinel. Enabling writes the given
 * start level (defaulting to the server default), validated to a level a
 * character can actually be (1..MAX_PLAYER_LEVEL). Returns null on an
 * out-of-range or non-integer start level.
 */
export function targetValueFor(input: { enabled: boolean; startLevel?: number }): string | null {
  if (!input.enabled) {
    return String(DISABLED_LEVEL);
  }
  const level = input.startLevel ?? DEFAULT_START_LEVEL;
  if (!Number.isInteger(level) || level < 1 || level > MAX_PLAYER_LEVEL) {
    return null;
  }
  return String(level);
}
