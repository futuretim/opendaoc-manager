import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { config, corsOrigins, type AppConfig } from "./config.js";
import { requireAuth } from "./auth/guards.js";
import { accountRoutes } from "./routes/accounts.js";
import { authRoutes } from "./routes/auth.js";
import { banRoutes } from "./routes/bans.js";
import { characterRoutes } from "./routes/characters.js";
import { healthRoutes } from "./routes/health.js";

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
      });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
