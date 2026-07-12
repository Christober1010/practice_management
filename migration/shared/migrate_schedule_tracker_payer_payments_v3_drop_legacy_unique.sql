-- v3: Allow duplicate imported report lines to carry independent payment values.
-- Drops legacy uniqueness by (client_id, insurance_id, dos, service_code).
-- Run on BOTH prod and test after v2 report_id migration.

ALTER TABLE payer_payment_entries
  DROP INDEX uq_payer_payment_line;
