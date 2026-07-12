-- Schedule Tracker workflow: tracker_status on reports; bank_deposited_at on payer_payment_entries
-- Run on both prod and test databases.
--
-- tracker_status values: Pending, Reviewed, Excluded, Pending Payment, Received Payment
-- Legacy: Payment Posted → Pending Payment, Payment Cleared → Received Payment
-- If ERROR 1060 (Duplicate column): that step already ran — skip and continue.

ALTER TABLE reports
  ADD COLUMN tracker_status VARCHAR(32) NULL DEFAULT 'Pending'
  COMMENT 'Schedule tracker workflow status'
  AFTER misc_hrs;

UPDATE reports
  SET tracker_status = 'Pending'
  WHERE tracker_status IS NULL OR TRIM(tracker_status) = '';

ALTER TABLE payer_payment_entries
  ADD COLUMN bank_deposited_at DATETIME NULL DEFAULT NULL
  COMMENT 'When check was deposited to bank (Received Payment)'
  AFTER check_number;

UPDATE reports SET tracker_status = 'Pending Payment' WHERE tracker_status = 'Payment Posted';
UPDATE reports SET tracker_status = 'Received Payment' WHERE tracker_status = 'Payment Cleared';
