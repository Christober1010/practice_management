  -- Mileage reimbursement: org rate + claims + legs.
  -- Run on prod + test Mahaverse DBs. Idempotent.

  CREATE TABLE IF NOT EXISTS mileage_settings (
    id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    rate_per_mile DECIMAL(8,4) NOT NULL DEFAULT 0.4500
      COMMENT 'USD (or currency) reimbursed per mile',
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    updated_by VARCHAR(255) NULL DEFAULT NULL,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  INSERT INTO mileage_settings (id, rate_per_mile, currency)
  VALUES (1, 0.4500, 'USD')
  ON DUPLICATE KEY UPDATE id = id;

  CREATE TABLE IF NOT EXISTS mileage_claims (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id VARCHAR(64) NOT NULL,
    provider_name VARCHAR(255) NULL DEFAULT NULL,
    claim_date DATE NOT NULL,
    rate_per_mile DECIMAL(8,4) NOT NULL,
    total_miles DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted'
      COMMENT 'draft | submitted | approved | void',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment'
      COMMENT 'pending_payment | paid',
    pay_date DATE NULL DEFAULT NULL
      COMMENT 'Required when payment_status = paid',
    check_number VARCHAR(64) NULL DEFAULT NULL
      COMMENT 'Required when payment_status = paid',
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NULL DEFAULT NULL,
    updated_by VARCHAR(255) NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mileage_claim_provider_date (provider_id, claim_date),
    KEY idx_mileage_claims_date (claim_date),
    KEY idx_mileage_claims_payment_status (payment_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  CREATE TABLE IF NOT EXISTS mileage_legs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    claim_id BIGINT UNSIGNED NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    from_session_id INT NULL DEFAULT NULL,
    to_session_id INT NULL DEFAULT NULL,
    from_stop_key VARCHAR(64) NULL DEFAULT NULL
      COMMENT 'home:{provider_id} or session:{id}',
    to_stop_key VARCHAR(64) NULL DEFAULT NULL,
    from_label VARCHAR(255) NOT NULL,
    to_label VARCHAR(255) NOT NULL,
    from_address VARCHAR(512) NULL DEFAULT NULL,
    to_address VARCHAR(512) NULL DEFAULT NULL,
    from_lat DECIMAL(10,7) NULL DEFAULT NULL,
    from_lng DECIMAL(10,7) NULL DEFAULT NULL,
    to_lat DECIMAL(10,7) NULL DEFAULT NULL,
    to_lng DECIMAL(10,7) NULL DEFAULT NULL,
    miles DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    excluded TINYINT(1) NOT NULL DEFAULT 0,
    is_home_leg TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_mileage_legs_claim (claim_id),
    CONSTRAINT fk_mileage_legs_claim
      FOREIGN KEY (claim_id) REFERENCES mileage_claims(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
