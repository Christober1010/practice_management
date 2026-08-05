-- Mileage claims: pay date + check # required when payment_status = paid.
-- Idempotent.

SET @db := DATABASE();

SET @has_pay_date := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'mileage_claims'
    AND COLUMN_NAME = 'pay_date'
);

SET @sql_pay_date := IF(
  @has_pay_date = 0,
  "ALTER TABLE mileage_claims
     ADD COLUMN pay_date DATE NULL DEFAULT NULL
       COMMENT 'Required when payment_status = paid'
       AFTER payment_status",
  'SELECT ''mileage_claims.pay_date already exists'' AS info'
);

PREPARE stmt FROM @sql_pay_date;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_check := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'mileage_claims'
    AND COLUMN_NAME = 'check_number'
);

SET @sql_check := IF(
  @has_check = 0,
  "ALTER TABLE mileage_claims
     ADD COLUMN check_number VARCHAR(64) NULL DEFAULT NULL
       COMMENT 'Required when payment_status = paid'
       AFTER pay_date",
  'SELECT ''mileage_claims.check_number already exists'' AS info'
);

PREPARE stmt FROM @sql_check;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
