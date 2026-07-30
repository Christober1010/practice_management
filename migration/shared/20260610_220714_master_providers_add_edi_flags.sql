-- EDI / rendering flags on insurance payer (master_providers).
-- Safe to re-run: skips ALTER when columns already exist.

SET @mp_db := DATABASE();

SET @edi_payer_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mp_db AND TABLE_NAME = 'master_providers' AND COLUMN_NAME = 'edi_payer'
);
SET @edi_payer_sql := IF(@edi_payer_exists = 0,
  'ALTER TABLE `master_providers` ADD COLUMN `edi_payer` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''EDI Payer Yes/No''',
  'SELECT ''skip: master_providers.edi_payer already exists'' AS providers_migration_note'
);
PREPARE edi_payer_stmt FROM @edi_payer_sql;
EXECUTE edi_payer_stmt;
DEALLOCATE PREPARE edi_payer_stmt;

SET @tech_render_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @mp_db AND TABLE_NAME = 'master_providers' AND COLUMN_NAME = 'technician_is_rendering_provider'
);
SET @tech_render_sql := IF(@tech_render_exists = 0,
  'ALTER TABLE `master_providers` ADD COLUMN `technician_is_rendering_provider` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Technician is Rendering Provider Yes/No''',
  'SELECT ''skip: master_providers.technician_is_rendering_provider already exists'' AS providers_migration_note'
);
PREPARE tech_render_stmt FROM @tech_render_sql;
EXECUTE tech_render_stmt;
DEALLOCATE PREPARE tech_render_stmt;
