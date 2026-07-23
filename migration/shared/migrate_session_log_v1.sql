-- Session Log: sticky-note workflow for internal scheduling sessions.
-- Run on both prod and test databases.
--
-- log_status values:
--   NULL / ''           = still on Rendered tray (when session STATUS = Rendered)
--   'Pending Payment'   = Pending Payments tab
--   'Received Payment'  = Received Payments tab
--
-- If ERROR 1050 (table already exists): skip — migration already applied.

CREATE TABLE IF NOT EXISTS session_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT NOT NULL,
  misc_hrs DECIMAL(5,2) NULL DEFAULT NULL
    COMMENT 'Session log: misc / miss hours',
  log_status VARCHAR(32) NULL DEFAULT NULL
    COMMENT 'Pending Payment | Received Payment; NULL = Rendered tray',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL DEFAULT NULL,
  updated_by VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_log_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
