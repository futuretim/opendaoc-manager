import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { config, corsOrigins, type AppConfig } from "./config.js";
import { requireAuth, requireRole } from "./auth/guards.js";
import { abilityRoutes } from "./routes/abilities.js";
import { accountRoutes } from "./routes/accounts.js";
import { auditRoutes } from "./routes/audit.js";
import { authRoutes } from "./routes/auth.js";
import { banRoutes } from "./routes/bans.js";
import { characterRoutes } from "./routes/characters.js";
import { economyRoutes } from "./routes/economy.js";
import { geographyRoutes } from "./routes/geography.js";
import { healthRoutes } from "./routes/health.js";
import { itemRoutes } from "./routes/items.js";
import { npcRoutes } from "./routes/npcs.js";
import { questRoutes } from "./routes/quests.js";
import { serverPropertyRoutes } from "./routes/serverProperties.js";
import { staffRoutes } from "./routes/staff.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === "development"
        ? { level: "debug", transport: { target: "pino-pretty", options: { colorize: true } } }
        : { level: "info" },
  });

  app.decorate("config", config);

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // All application routes live under /api/v1.
  await app.register(
    async (api) => {
      // Public (no session required).
      await healthRoutes(api);
      await authRoutes(api);

      // Protected: everything here requires a valid staff session.
      await api.register(async (secure) => {
        secure.addHook("preHandler", requireAuth);
        await accountRoutes(secure);
        await characterRoutes(secure);
        await banRoutes(secure);
        await questRoutes(secure);
        await itemRoutes(secure);
        await npcRoutes(secure);
        await economyRoutes(secure);
        await abilityRoutes(secure);
        await geographyRoutes(secure);
        await serverPropertyRoutes(secure);

        // Admin-only: staff management + audit log.
        await secure.register(async (admin) => {
          admin.addHook("preHandler", requireRole("admin"));
          await staffRoutes(admin);
          await auditRoutes(admin);
        });
      });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
