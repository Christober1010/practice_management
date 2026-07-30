# RBAC matrix QA checklist

Run database migration first: [20260729_222552_migrate_rbac_matrix_v1.sql](../migration/shared/20260729_222552_migrate_rbac_matrix_v1.sql) (adds `access_scope`, `users.link_staff_id` / `link_client_id`, new permissions, default grants). Adjust grants in **Admin → Role permissions** as needed.

## Admin UI (Role permissions)

1. Log in as **admin**, open Role permissions / Role access.
2. Confirm roles list includes: **admin, bcba, rbt, biller, parent, planner, client**.
3. For a tri-state permission (e.g. **Scheduling: View session**), set **Off / Self / All**, save, reload — value persists.
4. Save **BCBA** with session actions **Self**; confirm API denies another provider’s session (see Scheduling API below).

## Scheduling API (`add-session.php`)

Authenticated requests only (Bearer or session).

| Action | Expect |
|--------|--------|
| POST create | **403** if role lacks `scheduling.session.create` (or legacy `scheduling.write`) with correct scope vs `provider`. |
| PUT update / notes | **403** if not allowed for session’s `provider_id`. |
| DELETE | **403** if not allowed for session’s `provider_id`. |

**Self scope:** set `users.link_staff_id` to the staff `id` used as session provider (or match `users.email` to `staff.email`), then log in as BCBA/RBT and verify only matching `provider_id` works.

## Clients API

| Endpoint | Expect |
|----------|--------|
| `get-clients.php` | **403** without `clients.read` / `clients.view`. With **clients.view** scope **self**, list only includes rows allowed by `rbac_user_may_access_client_row` (linked client, or `staff_client_assignments`). |
| `add-clients.php` | **403** without `clients.create` or legacy `clients.write`. `rbac_enforce_client_action(..., 'create')` denies **self**-only create. |
| `update-clients.php` | Requires `clients.update` or legacy `clients.write`; **archive** path checks `clients.archive`. |

## Session notes (`session-notes.php`)

- GET/POST with `client_id`: **403** if `rbac_user_may_access_client_row` fails for that client.

## Legacy / DB off

- `RBAC_USE_DB=0` or missing RBAC tables: behavior falls back to `rbac_legacy_mahaverse()` in [rbac_helpers.php](rbac_helpers.php).

## Follow-ups (not fully automated here)

- Master data / manage-data PHP routes: add the same pattern (`rbac_user_has_permission_key` + fine keys) per endpoint.
- Prompts: restrict `master_data.prompts` to admin in grants; BCBA default seed omits prompt **manage** key (view only via `view.prompts`).
