-- Manager database schema (owned by OpenDAoC Manager).
-- Applied by `npm run migrate`. Idempotent: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS manager_user (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'gm') NOT NULL DEFAULT 'gm',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manager_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS session (
  id            CHAR(36) NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_session_user (user_id),
  KEY idx_session_expires (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id)
    REFERENCES manager_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id INT UNSIGNED NULL,
  action        VARCHAR(100) NOT NULL,
  target        VARCHAR(255) NULL,
  metadata      JSON NULL,
  ip            VARCHAR(64) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
