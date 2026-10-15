import { managerDb } from "./db/managerDb.js";
import { logger } from "./logger.js";

export interface AuditInput {
  actorUserId: number | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Append a row to the Manager audit log. Best-effort: a logging failure must
 * never fail the underlying operation, but it is logged loudly.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await managerDb.query(
      "INSERT INTO audit_log (actor_user_id, action, target, metadata, ip) VALUES (?, ?, ?, ?, ?)",
      [
        input.actorUserId,
        input.action,
        input.target ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.ip ?? null,
      ],
    );
  } catch (err) {
    logger.error({ err, action: input.action, target: input.target }, "failed to write audit log");
  }
}
