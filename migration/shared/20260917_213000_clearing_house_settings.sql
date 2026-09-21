-- Manage Data → Clearing House (Office Ally SFTP settings stored in DB).

CREATE TABLE IF NOT EXISTS clearing_house_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  provider_key VARCHAR(32) NOT NULL DEFAULT 'office_ally',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  sftp_host VARCHAR(255) NULL DEFAULT NULL,
  sftp_port INT NOT NULL DEFAULT 22,
  sftp_user VARCHAR(128) NULL DEFAULT NULL,
  sftp_password VARCHAR(255) NULL DEFAULT NULL,
  sftp_remote_dir VARCHAR(128) NULL DEFAULT 'inbound',
  sftp_reports_dir VARCHAR(128) NULL DEFAULT 'outbound',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(128) NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
