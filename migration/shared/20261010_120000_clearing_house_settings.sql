-- Master Data → Clearing House: Office Ally SFTP / EDI settings editable from the UI.
-- Values here override backend .env OFFICEALLY_* when non-empty. The SFTP password is
-- AES-256-GCM encrypted (OFFICEALLY_CONFIG_ENCRYPTION_KEY). clearing-house-settings.php also
-- auto-creates this table. Run on prod + test Mahaverse DBs. Idempotent.

CREATE TABLE IF NOT EXISTS clearing_house_settings (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    clearing_house VARCHAR(40) NOT NULL DEFAULT 'officeally',
    enabled TINYINT(1) NULL,
    environment VARCHAR(20) NULL,
    sftp_host VARCHAR(255) NULL,
    sftp_port INT NULL,
    sftp_user VARCHAR(255) NULL,
    sftp_password_enc TEXT NULL,
    sftp_remote_dir VARCHAR(255) NULL,
    sftp_reports_dir VARCHAR(255) NULL,
    isa_sender_id VARCHAR(40) NULL,
    isa_sender_qualifier VARCHAR(4) NULL,
    isa_receiver_qualifier VARCHAR(4) NULL,
    gs_sender_code VARCHAR(40) NULL,
    gs_receiver_code VARCHAR(40) NULL,
    submitter_name VARCHAR(120) NULL,
    receiver_id VARCHAR(40) NULL,
    receiver_name VARCHAR(120) NULL,
    file_prefix VARCHAR(20) NULL,
    updated_by VARCHAR(255) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO clearing_house_settings (id, clearing_house) VALUES (1, 'officeally');
