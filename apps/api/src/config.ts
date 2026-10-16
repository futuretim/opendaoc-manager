import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Load .env from the repo root (two levels up) and the local app dir.
loadDotenv({ path: "../../.env" });
loadDotenv();

const booleanish = z
  .string()
  .transform((v) => v === "true" || v === "1")
  .pipe(z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  COOKIE_SECURE: booleanish.default("false"),

  GAME_DB_HOST: z.string().default("127.0.0.1"),
  GAME_DB_PORT: z.coerce.number().int().positive().default(3306),
  GAME_DB_USER: z.string().default("opendaoc"),
  GAME_DB_PASSWORD: z.string().default(""),
  GAME_DB_NAME: z.string().default("opendaoc"),

  MANAGER_DB_HOST: z.string().default("127.0.0.1"),
  MANAGER_DB_PORT: z.coerce.number().int().positive().default(3306),
  MANAGER_DB_USER: z.string().default("opendaoc_manager"),
  MANAGER_DB_PASSWORD: z.string().default(""),
  MANAGER_DB_NAME: z.string().default("opendaoc_manager"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message rather than a cryptic runtime error later.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const config = parsed.data;
export type AppConfig = typeof config;

export const corsOrigins = config.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
