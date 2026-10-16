import { managerDb } from "../db/managerDb.js";
import { hashStaffPassword } from "../auth/password.js";
import { logger } from "../logger.js";

/**
 * Create (or update) a Manager staff user.
 *
 *   npm run create-user --workspace apps/api -- <email> <password> [admin|gm]
 *
 * Re-running with the same email updates the password/role (idempotent).
 */
async function main(): Promise<void> {
  const [email, password, roleArg] = process.argv.slice(2);
  const role = roleArg ?? "admin";

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.error("Usage: create-user <email> <password> [admin|gm]");
    process.exit(2);
  }
  if (role !== "admin" && role !== "gm") {
    // eslint-disable-next-line no-console
    console.error(`Invalid role '${role}' (expected 'admin' or 'gm')`);
    process.exit(2);
  }

  const hash = hashStaffPassword(password);
  await managerDb.query(
    `INSERT INTO manager_user (email, password_hash, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1`,
    [email, hash, role],
  );

  logger.info({ email, role }, "staff user created/updated");
  await managerDb.end();
}

main().catch((err) => {
  logger.error({ err }, "failed to create user");
  process.exit(1);
});
