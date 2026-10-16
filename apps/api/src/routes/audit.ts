import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listAudit } from "../db/auditLog.js";

const query = z.object({
  action: z.string().optional(),
  actorUserId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get("/audit", async (request) => {
    const { action, actorUserId, page, pageSize } = query.parse(request.query);
    const items = await listAudit({
      action,
      actorUserId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { items, page, pageSize };
  });
}
