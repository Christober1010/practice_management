-- Session Log payment fields (Pending Payments / Received Payments tabs)
-- Run on both prod and test databases.
-- If ERROR 1060 (Duplicate column): that column already exists — skip and continue.

ALTER TABLE session_log
  ADD COLUMN coinsurance_amount DECIMAL(12,2) NULL DEFAULT NULL
    COMMENT 'Session log: co-insurance amount'
    AFTER log_status;

ALTER TABLE session_log
  ADD COLUMN copay_amount DECIMAL(12,2) NULL DEFAULT NULL
    COMMENT 'Session log: copay amount'
    AFTER coinsurance_amount;

ALTER TABLE session_log
  ADD COLUMN deductible_amount DECIMAL(12,2) NULL DEFAULT NULL
    COMMENT 'Session log: deductible amount'
    AFTER copay_amount;

ALTER TABLE session_log
  ADD COLUMN payer_paid_amount DECIMAL(12,2) NULL DEFAULT NULL
    COMMENT 'Session log: payer paid amount'
    AFTER deductible_amount;

ALTER TABLE session_log
  ADD COLUMN check_number VARCHAR(100) NULL DEFAULT NULL
    COMMENT 'Session log: check number'
    AFTER payer_paid_amount;

ALTER TABLE session_log
  ADD COLUMN ap_invoice VARCHAR(64) NULL DEFAULT NULL
    COMMENT 'Session log: AP invoice reference'
    AFTER check_number;

ALTER TABLE session_log
  ADD COLUMN ap_date DATE NULL DEFAULT NULL
    COMMENT 'Session log: AP date'
    AFTER ap_invoice;
