import type { FastifyInstance } from "fastify";
import { pingGameDb } from "../db/gameDb.js";
import { pingManagerDb } from "../db/managerDb.js";

/**
 * Liveness/readiness endpoints.
 *
 * GET /api/v1/health          — process is up (no DB needed).
 * GET /api/v1/health/ready     — reports connectivity to both databases.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_req, reply) => {
    const [game, manager] = await Promise.all([
      pingGameDb().catch(() => false),
      pingManagerDb().catch(() => false),
    ]);
    const ready = game && manager;
    reply.code(ready ? 200 : 503);
    return {
      status: ready ? "ready" : "degraded",
      checks: { gameDb: game, managerDb: manager },
    };
  });
}
