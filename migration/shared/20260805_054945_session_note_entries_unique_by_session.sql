-- Session notes: one entry per scheduling session (not per client+date).
-- Same-day multi-session days were sharing one note payload via uniq_client_session_date.
--
-- IMPORTANT: InnoDB uses uniq_client_session_date (client_id, ...) as the supporting
-- index for fk_session_entry_client. Dropping it first → #1553.
-- Safe order (no data loss — index/constraint changes only):
--   1) ensure an index that starts with client_id (new unique or plain KEY)
--   2) drop legacy uniq_client_session_date
-- Rows in client_session_note_entries are never deleted or rewritten.

SET @note_db := DATABASE();

-- 1a. Supporting KEY on client_id so the FK can leave the legacy unique.
SET @add_client_idx := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @note_db
        AND TABLE_NAME = 'client_session_note_entries'
        AND INDEX_NAME = 'idx_note_entry_client'
    ),
    'SELECT ''skip: idx_note_entry_client already exists'' AS session_notes_migration_note',
    'ALTER TABLE `client_session_note_entries` ADD KEY `idx_note_entry_client` (`client_id`)'
  )
);
PREPARE stmt FROM @add_client_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1b. New uniqueness: one note payload per linked scheduling session.
SET @add_session_uq := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @note_db
        AND TABLE_NAME = 'client_session_note_entries'
        AND INDEX_NAME = 'uniq_client_session_id'
    ),
    'SELECT ''skip: uniq_client_session_id already exists'' AS session_notes_migration_note',
    'ALTER TABLE `client_session_note_entries` ADD UNIQUE KEY `uniq_client_session_id` (`client_id`, `session_id`)'
  )
);
PREPARE stmt FROM @add_session_uq;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Drop legacy unique (client_id, session_date) — FK now uses idx_note_entry_client.
SET @drop_legacy := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = @note_db
        AND TABLE_NAME = 'client_session_note_entries'
        AND INDEX_NAME = 'uniq_client_session_date'
    ),
    'ALTER TABLE `client_session_note_entries` DROP INDEX `uniq_client_session_date`',
    'SELECT ''skip: uniq_client_session_date already dropped'' AS session_notes_migration_note'
  )
);
PREPARE stmt FROM @drop_legacy;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
