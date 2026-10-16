import type { RowDataPacket } from "mysql2";
import { managerDb } from "./managerDb.js";

export interface AuditEntry {
  id: number;
  actorUserId: number | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  metadata: unknown | null;
  ip: string | null;
  createdAt: string | null;
}

interface AuditRow extends RowDataPacket {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  action: string;
  target: string | null;
  metadata: unknown | null;
  ip: string | null;
  created_at: string | null;
}

export async function listAudit(params: {
  action?: string;
  actorUserId?: number;
  limit: number;
  offset: number;
}): Promise<AuditEntry[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (params.action) {
    where.push("a.action = ?");
    values.push(params.action);
  }
  if (typeof params.actorUserId === "number") {
    where.push("a.actor_user_id = ?");
    values.push(params.actorUserId);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")} ` : "";
  values.push(params.limit, params.offset);

  const [rows] = await managerDb.query<AuditRow[]>(
    `SELECT a.id, a.actor_user_id, u.email AS actor_email, a.action, a.target,
            a.metadata, a.ip, a.created_at
       FROM audit_log a
       LEFT JOIN manager_user u ON u.id = a.actor_user_id
       ${whereClause}ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    values,
  );

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    actorEmail: r.actor_email,
    action: r.action,
    target: r.target,
    // mysql2 returns JSON columns already parsed; pass through defensively.
    metadata:
      typeof r.metadata === "string" ? safeParse(r.metadata) : (r.metadata ?? null),
    ip: r.ip,
    createdAt: r.created_at,
  }));
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
