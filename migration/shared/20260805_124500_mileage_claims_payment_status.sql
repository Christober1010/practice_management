-- Mileage claims: payment status (Pending Payment | Paid), separate from claim workflow status.
-- Idempotent.

SET @db := DATABASE();

SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'mileage_claims'
    AND COLUMN_NAME = 'payment_status'
);

SET @sql := IF(
  @has_col = 0,
  "ALTER TABLE mileage_claims
     ADD COLUMN payment_status VARCHAR(32) NOT NULL DEFAULT 'pending_payment'
       COMMENT 'pending_payment | paid'
       AFTER status,
     ADD KEY idx_mileage_claims_payment_status (payment_status)",
  'SELECT ''mileage_claims.payment_status already exists'' AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
