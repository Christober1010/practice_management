# Mahaverse RBAC: role access and scopes

This document describes **default** grants after running [`20260729_222552_migrate_rbac_matrix_v1.sql`](../migration/shared/20260729_222552_migrate_rbac_matrix_v1.sql) and later additive migrations (e.g. [`20260831_220000_rbac_scheduling_create_past.sql`](../migration/shared/20260831_220000_rbac_scheduling_create_past.sql)). Admins can change any cell in **Admin → Role permissions**; production values live in `rbac_role_grants` (and may differ from this table).

**App scope:** all rows below are `app_scope = mahaverse` unless noted.

## What `access_scope` means

| Scope | Meaning |
|--------|--------|
| **all** | Permission applies organization-wide (subject to the permission key itself). For **`clients.view` / `clients.read`**, the client list API returns the org roster (active rows for non-admin). |
| **self** | Permission applies only when the action targets data linked to the logged-in user (e.g. session `provider_id` matches `users.link_staff_id` / staff record, or client rows allowed for that user). For **`clients.view`**, that means `staff_client_assignments` or `link_client_id` only. Backend helpers enforce this; **self** is not automatic on every endpoint. |

**Roles** map to `users.role` (lowercase). Users with role **admin** typically bypass UI gates; API enforcement still uses the DB matrix where implemented.

---

## Quick overview

| Role | Scheduling | Clients | Staff | Users | Data collection | Manage data | Billing / reports |
|------|------------|---------|-------|-------|-----------------|-------------|-------------------|
| **admin** | Full (`all`) | Full (`all`) | Full (`all`) | Full (`all`) | Full (`all`) | Full (`all`) | Full (`all`) |
| **planner** | Full session CRUD (`all`) | — | — | — | — | — | — |
| **bcba** | Create/view/notes/update **self**; no session delete; **no** past-date create | Read `all`; view **self**; no create/archive | Read + write `all` | — | Read/write + domains/programs/targets manage `all`; no `master_data.prompts` | Read `all` | — |
| **rbt** | View session + notes **self** only; no create/update/delete | Read + view **self** (assigned) | Read `all` | — | — | — | — |
| **biller** | — | Read/view/update `all`; **no** `clients.create` | — | — | — | Read/write + fine provider/service/diagnosis keys `all` | Read/write `all` |
| **parent** | — | — | — | — | — | — | — (dashboard only) |
| **client** | — | Read/view/update **self** (own record) | — | — | — | — | — |

---

## admin

**Rule:** Every permission row with `app_scope = 'mahaverse'` is granted with **`access_scope = all`**.

That includes all navigation and view keys, legacy coarse keys (`clients.write`, `scheduling.write`, …), and fine-grained keys (`scheduling.session.*`, `clients.create`, `clients.archive`, `staff.archive`, `users.delete`, `users.deactivate`, `master_data.*`, `manage_data.*`, …).

---

## planner

| Permission key | Access scope |
|----------------|--------------|
| `nav.scheduling` | all |
| `view.scheduling` | all |
| `scheduling.read` | all |
| `scheduling.write` | all |
| `scheduling.session.create` | all |
| `scheduling.session.create_past` | all |
| `scheduling.session.view` | all |
| `scheduling.session.notes` | all |
| `scheduling.session.update` | all |
| `scheduling.session.delete` | all |

---

## bcba

| Permission key | Access scope |
|----------------|--------------|
| `nav.scheduling` | all |
| `nav.clients` | all |
| `nav.launchpad` | all |
| `nav.staff` | all |
| `view.scheduling` | all |
| `view.clients` | all |
| `view.launchpad` | all |
| `view.staff` | all |
| `view.domains` | all |
| `view.programs` | all |
| `view.targets` | all |
| `view.prompts` | all |
| `clients.read` | all |
| `clients.view` | **self** |
| `staff.read` | all |
| `staff.write` | all |
| `scheduling.read` | all |
| `scheduling.write` | all |
| `scheduling.session.create` | **self** |
| `scheduling.session.view` | **self** |
| `scheduling.session.notes` | **self** |
| `scheduling.session.update` | **self** |
| `master_data.read` | all |
| `master_data.write` | all |
| `master_data.domains` | all |
| `master_data.programs` | all |
| `master_data.targets` | all |
| `manage_data.read` | all |

**Not granted by default:** `scheduling.session.create_past` (today/future creates only), `scheduling.session.delete`, `clients.create`, `clients.update`, `clients.archive`, `master_data.prompts`, `nav.users`, `users.*`, `reports.*`, `billing.*`, etc. (add via Admin if needed.)

---

## rbt

| Permission key | Access scope |
|----------------|--------------|
| `nav.scheduling` | all |
| `nav.clients` | all |
| `nav.launchpad` | all |
| `nav.staff` | all |
| `view.scheduling` | all |
| `view.clients` | all |
| `view.launchpad` | all |
| `view.staff` | all |
| `clients.read` | **self** |
| `clients.view` | **self** |
| `staff.read` | all |
| `scheduling.read` | all |
| `scheduling.session.view` | **self** |
| `scheduling.session.notes` | **self** |

**Client roster:** `clients.view` / `clients.read` **self** = assigned or linked clients only. Set to **all** in Admin → Role permissions for org-wide lists (e.g. biller). Backend honors this scope in `get-clients.php`.

**Not granted by default:** session create/update/delete, `scheduling.write`, staff write, master data manage keys, etc.

---

## biller

| Permission key | Access scope |
|----------------|--------------|
| `nav.dashboard` | all |
| `nav.clients` | all |
| `nav.billing` | all |
| `nav.manage_data` | all |
| `view.dashboard` | all |
| `view.clients` | all |
| `view.billing` | all |
| `view.manage_data` | all |
| `view.provider` | all |
| `view.provider_service_code` | all |
| `view.service_code` | all |
| `view.diagnosis` | all |
| `clients.read` | all |
| `clients.view` | all |
| `clients.update` | all |
| `manage_data.read` | all |
| `manage_data.write` | all |
| `manage_data.provider` | all |
| `manage_data.provider_service` | all |
| `manage_data.service_code` | all |
| `manage_data.diagnosis` | all |
| `billing.read` | all |
| `billing.write` | all |
| `billing.sftp` | all (Office Ally SFTP submit; also default for **admin**) |

**Not granted by default:** `clients.create`, scheduling, staff, users, reports, data collection editor keys, etc.

---

## parent

| Permission key | Access scope |
|----------------|--------------|
| `nav.dashboard` | all |
| `view.dashboard` | all |

---

## client

| Permission key | Access scope |
|----------------|--------------|
| `nav.dashboard` | **self** |
| `nav.clients` | **self** |
| `view.dashboard` | **self** |
| `view.clients` | **self** |
| `clients.read` | **self** |
| `clients.view` | **self** |
| `clients.update` | **self** |

**Meaning:** portal-style access to the linked client record only; enforcement uses `users.link_client_id` / client linkage where APIs support it.

---

## Legacy permission keys (still in catalog)

These may appear on **admin** (full grant) or older saved matrices. APIs often treat them as aliases for fine keys (see `rbac_helpers.php`).

| Key | Typical meaning |
|-----|-----------------|
| `clients.read` | View clients (coarse) |
| `clients.write` | Create/edit clients (coarse; prefer `clients.create` / `clients.update`) |
| `scheduling.read` | View scheduling (coarse) |
| `scheduling.write` | Create/edit scheduling (coarse; prefer `scheduling.session.*`) |
| `master_data.write` | Data collection edit (coarse) |
| `manage_data.write` | Manage data edit (coarse) |

---

## Source of truth

| Artifact | Purpose |
|----------|---------|
| [`20260729_222552_migrate_rbac_matrix_v1.sql`](../migration/shared/20260729_222552_migrate_rbac_matrix_v1.sql) | Default `rbac_role_grants` + `access_scope` |
| [`rbac-matrix.php`](rbac-matrix.php) | JSON for Admin UI |
| [`rbac_helpers.php`](rbac_helpers.php) | Server checks + legacy key expansion |
| [`RBAC_MATRIX_QA.md`](RBAC_MATRIX_QA.md) | Manual QA steps |

If this file and the database disagree, **trust the database** after migration and admin edits.
