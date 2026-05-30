  -- reports: link rows to Mahaverse client + staff/provider; payer_payment_entries: link to report line
  -- Run on test + prod. If a step errors with "duplicate column", skip that step.

  ALTER TABLE reports
    ADD COLUMN client_id VARCHAR(64) NULL DEFAULT NULL COMMENT 'Mahaverse clients.client_id'
      AFTER id,
    ADD COLUMN provider_id VARCHAR(64) NULL DEFAULT NULL COMMENT 'staff.id or rendering provider key'
      AFTER client_id;

  ALTER TABLE payer_payment_entries
    ADD COLUMN report_id INT UNSIGNED NULL DEFAULT NULL COMMENT 'reports.id'
      AFTER id;

  ALTER TABLE payer_payment_entries
    ADD UNIQUE KEY uq_payer_payment_report_id (report_id);
