-- Denormalized auth # and CPT/service code on sessions for claims and reporting.
-- Populated from client_auth at session create/update (see session_persist_auth_service_fields).
--
-- Shared-hosting safe: no information_schema / PREPARE (many hosts deny those).
-- Run each statement below once. If you get #1060 Duplicate column name, skip that line.

ALTER TABLE `sessions`
  ADD COLUMN `authorization_number` VARCHAR(100) NULL DEFAULT NULL
  COMMENT 'Auth # from client_auth at session save';

ALTER TABLE `sessions`
  ADD COLUMN `service_code` VARCHAR(50) NULL DEFAULT NULL
  COMMENT 'Primary billing/service code from client_auth at session save';
