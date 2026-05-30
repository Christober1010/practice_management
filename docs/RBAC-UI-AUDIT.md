# RBAC: UI vs server enforcement (Mahaverse)

**Date:** 2026-04-20 (repo scan)  
**Focus:** Client module (Biller / “Add client” & “Create / Edit” off in matrix, but **+ Add Client** still visible)

## Executive summary

| Layer | Clients create / update / archive |
|--------|-------------------------------------|
| **Backend (PHP)** | Largely **enforced** on the main client APIs (see below). A user without the right keys should get **403** on create/update, not a silent success. |
| **Frontend (Next.js)** | **Not enforced** on the Client Management screen. `components/clients/clients-view.jsx` does **not** use `usePermissions` or `can(PERM.…)` to hide **+ Add Client**, row **Edit** actions, or **Archive** — so the UI can **overstate** what the user is allowed to do. |
| **Shell** | **Partially enforced:** sidebar and “enter this screen” use `view.*` only. Reaching the Clients page requires `view.clients`; it does **not** require `clients.create` or `clients.update`. |

**Conclusion:** The product is **not** “RBAC-safe by default” in the browser. The admin matrix is the source of truth for what the **server** will allow; the **client list UI** does not yet mirror it for buttons and row actions.

---

## 1. What you’re seeing (Biller + matrix off for add/create)

1. **Role access (first screenshot)** stores denials for keys like `clients.create` and the “Create / Edit” style keys in the matrix.  
2. **Server** `add-clients.php` / `update-clients.php` check `rbac_user_has_permission_key(…, 'clients.create'|'clients.write'|…)` and similar. If the **token’s** role really has no `clients.create` and no `clients.write`, **POST** add should be **403**.  
3. **The list page** still shows **+ Add Client** because that button is **unconditional** in `clients-view.jsx` (no `if (can(…))`).

So: **confusing UX** (button visible, API may refuse) unless you also gate the UI.

---

## 2. Frontend: where RBAC is implemented

### Implemented

| Location | Behavior |
|---------|----------|
| `hooks/usePermissions.js` | Builds a flat list of permission keys from `user.permissions` (server) or falls back to **`lib/rbac-legacy.js`** when the array is empty. |
| `components/layout/app-sidebar.jsx` | Uses `usePermissions` + **`PERM.VIEW_*`** etc. to **show/hide** nav items (e.g. Clients link only if `can(PERM.VIEW_CLIENTS)`). |
| `components/layout/dashboard-layout.jsx` | **Screen gate:** each `currentView` must satisfy `VIEW_REQUIRED_PERMISSION[currentView]` (e.g. `clients` → `view.clients`). **Special case:** `roleAccess` requires admin + `users.write`. |
| `components/auth/login-page.jsx` | Loads **`me-permissions.php`** and merges permissions into stored user so keys stay aligned with DB. |

### Not implemented (clients module UI)

| Location | Gap |
|---------|-----|
| `components/clients/clients-view.jsx` | **No** `usePermissions`, **no** `can(PERM.CLIENTS_CREATE)`, **no** checks on **Add Client**, **Edit**, **Archive**, dropdown actions. Same pattern as backup `clientviewbackup.js`. |
| `components/clients/add-client-modal.jsx` | Opens from parent; inherits **no** RBAC wrapper (parent doesn’t gate). |

**Observation:** Outside layout, **`usePermissions` appears only** in:

- `components/layout/app-sidebar.jsx`
- `components/layout/dashboard-layout.jsx`

No other feature views (`staff-view`, `scheduling-view`, `users-view`, `reports-view`, …) reference `usePermissions` in this codebase scan — so **module-level actions are largely unguarded** in React.

---

## 3. Backend: clients-related RBAC (representative)

| Endpoint | Enforcement (high level) |
|---------|-------------------------|
| `backend/get-clients.php` | Requires **`clients.read`** when authenticated (`rbac_user_has_permission_key`). |
| `backend/add-clients.php` | Requires **`clients.create`** **or** **`clients.write`**; additionally **`rbac_enforce_client_action(..., 'create', …)`** when user present. |
| `backend/update-clients.php` | **`clients.update`** **or** **`clients.write`** for general path; **`rbac_enforce_client_action`** for archive/update flows. |

Other domains (samples):

| Endpoint | Enforcement |
|---------|----------------|
| `backend/add-session.php` | **`rbac_enforce_session_action`** on create/update/delete paths. |
| `backend/staff.php` | Permission checks via `rbac_user_has_permission_key`. |

So **API** behavior is substantially closer to the intended matrix than **buttons** on the Clients page.

---

## 4. Legacy permission fallback (`lib/rbac-legacy.js`)

If `user.permissions` from the server is **empty**, `usePermissions` falls back to **`legacyPermissionsForRole(role)`**.

For **`biller`**, legacy includes **`clients.write`**, **`clients.view`**, **`clients.update`** (among others). That is **broader than** “view-only” if someone has no JWT permissions array yet.

Operational fix: ensure login always merges **`me-permissions.php`** so **`user.permissions`** reflects the matrix and legacy is not used for real users.

---

## 5. Tri-state keys (`clients.view`, `clients.update`)

`lib/rbac-scope-ui.js` treats **`clients.view`** and **`clients.update`** as tri-state in the admin UI (`self` / `all` / `off`).  

`usePermissions` today only checks **flat inclusion** (`keys.includes(permKey)`). Fine-grained **scope** (“self vs all”) for hiding columns or restricting which rows can be edited is **not fully modeled** in Client list UI — even after you add `can()`, you may need helpers that interpret stored scope from `me-permissions.php` if the API returns more than plain strings.

---

## 6. Recommendations

1. **`clients-view.jsx`**  
   - Hide **+ Add Client** unless `can(PERM.CLIENTS_CREATE)` **or** policy allows `clients.write` (match `add-clients.php`).  
   - Hide **Edit** unless update is allowed (`clients.update` / `clients.write`, aligned with `update-clients.php`).  
   - Hide **Archive** unless `clients.archive` / whatever `rbac_enforce_client_action` expects for `'archive'`.  

2. **Reuse one pattern:** `const { can, canAny } = usePermissions(userRole);` with `PERM` from `@/lib/rbac-permission-keys`.

3. **Regression test:** User with matrix “no create” → button hidden **and** POST returns 403 without relying on UX.

4. Optional: extend this audit table for **Scheduling**, **Staff**, **Reports** once those views add `usePermissions`.

---

## 7. File reference (quick index)

| Role | Files |
|------|--------|
| Canonical keys | `lib/rbac-permission-keys.js` |
| Hooks | `hooks/usePermissions.js` |
| Legacy fallback | `lib/rbac-legacy.js` |
| Sidebar / route shell | `components/layout/app-sidebar.jsx`, `components/layout/dashboard-layout.jsx` |
| Clients UI (gap) | `components/clients/clients-view.jsx` |
| Backend RBAC helpers | `backend/rbac_helpers.php` |
| Client APIs | `backend/add-clients.php`, `backend/update-clients.php`, `backend/get-clients.php` |

---

*Generated from repository analysis; adjust line references if files move.*
