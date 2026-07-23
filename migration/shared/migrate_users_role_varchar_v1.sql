-- Widen users.role so UI roles (biller, planner, client, …) persist.
-- Prod previously used an ENUM that omitted `biller` (and others); MySQL
-- non-strict mode silently stored '' and update-users.php still returned success.
--
-- Safe to re-run: VARCHAR(64) MODIFY is idempotent for already-migrated DBs.
-- Run on: production dbs14484433 and test dbs14649042 (and any other Mahaverse DB).

ALTER TABLE `users`
  MODIFY COLUMN `role` VARCHAR(64) NOT NULL DEFAULT '';
