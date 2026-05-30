-- reports: link rows to Mahaverse client + staff/provider; payer_payment_entries: link to report line
-- Run on test + prod.
--
-- If you see ERROR 1060 (Duplicate column name): that step already ran — skip it and run the next.
-- Run each block separately if your tool only accepts one statement at a time.

-- -----------------------------------------------------------------------------
-- reports — add client_id (skip if column already exists)
-- -----------------------------------------------------------------------------
ALTER TABLE reports
  ADD COLUMN client_id VARCHAR(64) NULL DEFAULT NULL COMMENT 'Mahaverse clients.client_id'
    AFTER id;

-- -----------------------------------------------------------------------------
-- reports — add provider_id (skip if column already exists)
-- -----------------------------------------------------------------------------
ALTER TABLE reports
  ADD COLUMN provider_id VARCHAR(64) NULL DEFAULT NULL COMMENT 'staff.id or rendering provider key'
    AFTER client_id;

-- -----------------------------------------------------------------------------
-- payer_payment_entries — link saved payment lines to schedule tracker row
-- Skip if report_id already exists (e.g. table was created from combined DDL).
-- -----------------------------------------------------------------------------
ALTER TABLE payer_payment_entries
  ADD COLUMN report_id INT UNSIGNED NULL DEFAULT NULL COMMENT 'reports.id'
    AFTER id;

-- -----------------------------------------------------------------------------
-- One payment line per report row when report_id is set (multiple NULLs allowed)
-- Skip if ERROR 1061 — Duplicate key name 'uq_payer_payment_report_id'.
-- -----------------------------------------------------------------------------
ALTER TABLE payer_payment_entries
  ADD UNIQUE KEY uq_payer_payment_report_id (report_id);
