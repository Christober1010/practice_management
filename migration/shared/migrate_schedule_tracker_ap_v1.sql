-- AP tracking on payer payment entries (Received Payment tab)
-- Run on both prod and test databases.

ALTER TABLE payer_payment_entries
  ADD COLUMN ap_invoice VARCHAR(64) NULL DEFAULT NULL
    COMMENT 'Accounts payable invoice reference'
    AFTER check_number,
  ADD COLUMN ap_date DATE NULL DEFAULT NULL
    COMMENT 'Accounts payable date'
    AFTER ap_invoice;
