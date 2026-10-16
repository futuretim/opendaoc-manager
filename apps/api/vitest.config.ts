import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Satisfy config.ts validation at import time (DB pools stay lazy).
    env: {
      NODE_ENV: "test",
      SESSION_SECRET: "test-session-secret-0123456789",
    },
  },
});
