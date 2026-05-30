-- Schedule Tracker: misc_hrs on reports; Payer Payments: payer_payment_entries
-- Run on both prod and test databases (same DDL).
--
-- HOW TO RUN
-- 1) Prefer running in two steps if your SQL editor only executes one statement at a time:
--    Run "STEP 1" below, then run "STEP 2".
-- 2) STEP 1: If misc_hrs already exists you will get ERROR 1060 (Duplicate column). That is OK — continue to STEP 2.
-- 3) STEP 2: If the table already exists, CREATE TABLE is skipped (IF NOT EXISTS). If a previous failed run left a bad table, fix manually before re-running.

-- =============================================================================
-- STEP 1 — reports.misc_hrs
-- =============================================================================
ALTER TABLE reports
  ADD COLUMN misc_hrs DECIMAL(5,2) NULL DEFAULT NULL
  COMMENT 'Schedule tracker: misc hours';

-- =============================================================================
-- STEP 2 — payer_payment_entries
-- Unique key uses a prefix on service_code so the composite index stays under
-- the InnoDB utf8mb4 limit (767 bytes on older MySQL 5.7).
-- =============================================================================
CREATE TABLE IF NOT EXISTS payer_payment_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(64) NOT NULL,
  insurance_id INT NOT NULL,
  dos DATE NOT NULL,
  service_code VARCHAR(255) NOT NULL,
  coinsurance_amount DECIMAL(12,2) NULL DEFAULT NULL,
  copay_amount DECIMAL(12,2) NULL DEFAULT NULL,
  deductible_amount DECIMAL(12,2) NULL DEFAULT NULL,
  payer_paid_amount DECIMAL(12,2) NULL DEFAULT NULL,
  check_number VARCHAR(100) NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payer_payment_line (client_id, insurance_id, dos, service_code(60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
