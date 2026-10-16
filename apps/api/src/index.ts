import { config } from "./config.js";
import { logger } from "./logger.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const app = await buildServer();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
  logger.info(`Manager API listening on :${config.API_PORT}`);
}

main().catch((err) => {
  logger.error({ err }, "failed to start API");
  process.exit(1);
});
