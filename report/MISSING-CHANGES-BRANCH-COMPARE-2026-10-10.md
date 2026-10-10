# Missing changes — branch scatter + live Dev/Prod (2026-10-10)

Recheck after accidental edits landed on different branches. Compares:

- `feature-ui-routing` @ `2ee5508` (committed)
- `java-backend` @ `3cea589` (scheduling work in `09cc1d2`)
- `test` @ `332aca5`
- **current working tree** on `feature-ui-routing` (uncommitted / staged)
- **live** Dev (`mahaverse-dev…`) and Prod (`mahaverse…`) UI bundles + backend endpoints

---

## Executive summary

| Area | Verdict |
|------|---------|
| Live Dev vs live Prod UI | **Same feature set** (markers match). Different page chunk hashes only (`page-762ccd…` vs `page-ff0dbd…`). |
| Live vs intended deploy branch | Live matches **feature WT hybrid** (Clearing House nav + Exclude Session + Data Collection hover), **not** pure committed `feature-ui-routing` HEAD and **not** `java-backend`. |
| **Ported into feature WT (2026-10-10 evening)** | Time-row create, appts multi-select filters, supervising-provider modal + libs/APIs, service-codes supervising rule, kept Data hover + Exclude Session. Exclude→Misc + Clearing House settings were already in WT. |
| Still needs | **Commit** + UI rebuild/deploy to Dev/Prod; confirm PHP deploy for session-log misc + service-code-rules. |
| Stranded on wrong branch (committed remotes) | Until you commit/push feature WT, remotes still look scattered (`java-backend` / `test` HEADs unchanged). |

---

## 1. Where work accidentally landed (committed)

Unique commits (using `refs/heads/…` to avoid the `java-backend/` path clash):

| Only on | Commits |
|---------|---------|
| `feature-ui-routing` | `2ee5508` Exclude Session admin + Appts Data hover; `1f4d80d` Maintenance periods; `b5fc53f` Claims billing helpers |
| `java-backend` | `09cc1d2` scheduling time-row + multi-select + new-session supervising rules; `3cea589` Java/Launchpad local setup |
| `test` | `332aca5` Session Notes/Data Collection reports API path + **Session Log Exclude→Misc harden** |

Files present on **exactly one** branch:

| Branch | Files only there |
|--------|------------------|
| `feature-ui-routing` | `maintenance-periods.php` (+test twin), `add-maintenance-period-modal.jsx`, `maintenance-periods-list.jsx` |
| `java-backend` | `clearing-house.php` + lib, `service-code-rules.php`, `clearing-house-view.jsx`, `client-assign-multi-select.jsx`, `lib/sort-clients.js`, `lib/authorization-units.js`, `lib/session-appointment-label.js`, `lib/session-notes-soap.js`, clearing-house + supervising-rule migrations |
| `test` | *(none unique by path — content differs inside shared files)* |

---

## 2. Live Dev vs live Prod

### UI feature markers (static JS)

| Marker | Dev | Prod |
|--------|-----|------|
| Exclude Session / `canEditExcludeSession` | YES | YES |
| Data Collection report | YES | YES |
| Session Notes report | YES | YES |
| Claims Ready to Bill / Submitted | YES | YES |
| Maintenance Period | YES | YES |
| Clearing House (nav card) | YES | YES |
| Configure Data / Clone / Gen Plan / Mastery / Target Status / Advanced / Skill Acquisition | YES | YES |
| Appts Data hover (`ClipboardList` + `data-collection`) | YES | YES |
| **Time-row create** (`Add session at` / `renderTimelineCreateSlots`) | **NO** | **NO** |
| **Appts multi-select** (`locationFilterIds`) | **NO** | **NO** |
| **Supervising provider rules** (`providerAsSupervising`) | **NO** | **NO** |
| `sortClientsByName` / `ReportFilterMultiSelect` in scheduling | **NO** | **NO** |

**Dev ≉ Prod identical bytes**, but **no feature-string differences** found — treat as same UI feature level.

### Backend endpoints (OPTIONS/GET, unauth → 401 = file present)

| Endpoint | Test API | Prod API |
|----------|----------|----------|
| `reports-session-notes.php` | 401 | 401 |
| `reports-data-collection.php` | 401 | 401 |
| `session-log.php` | 401 | 401 |
| `maintenance-periods.php` | 401 | 401 |
| `clearing-house.php` | 401 | 401 |
| `clearing-house-settings.php` | 401 | 401 |
| `service-code-rules.php` | 401 | 401 |

Note: `clearing-house.php` / `service-code-rules.php` exist on **live APIs** even though those files are **not** in feature working tree — backend deploys were mixed from `java-backend` at some point. UI on live uses feature WT’s **Clearing House settings** nav (`clearingHouse` → `clearing-house-settings.jsx`), which is a **different** component than java’s `clearing-house-view.jsx`.

---

## 3. Feature matrix (branches + WT + live)

| Item | feature HEAD | feature WT | java | test | live Dev | live Prod |
|------|:------------:|:----------:|:----:|:----:|:--------:|:---------:|
| Claims status + one CMS/claim | YES | YES | YES | partial | YES | YES |
| Session Notes / Data Collection reports UI | YES | YES | NO | YES | YES | YES |
| Exclude Session admin column | YES | YES | NO | YES | YES | YES |
| Appts Data hover → data-collection | YES | YES | NO | NO | YES | YES |
| Maintenance Period UI/API | YES | YES | NO | NO | YES | YES |
| Clearing House **settings** (feature WT) | NO | YES | NO | NO | YES* | YES* |
| Clearing House **view** (java) | NO | NO | YES | NO | API only | API only |
| Session Log Exclude→Misc sync | NO | **YES** | lib only | YES | ?† | ?† |
| **Time-row create appointment** | NO | NO | **YES** | NO | **NO** | **NO** |
| **Appts multi-select filters** | NO | NO | **YES** | NO | **NO** | **NO** |
| **New session supervising rules** | NO | NO | **YES** | NO | **NO** | **NO** |
| `lib/sort-clients.js` etc. | NO | NO | YES | NO | NO | NO |

\* Live shows “Clearing House” nav; matches feature WT wiring, not necessarily java’s view.  
† Misc sync PHP is in feature WT + on `test` branch; live API file exists but whether **deployed PHP** includes the new sync functions was not source-diffed on the server.

---

## 4. Actually missing (still need to consolidate)

### P0 — still missing on live Dev **and** Prod (and feature committed/WT)

1. **Appointments: click time row → create session**  
   - Source: `java-backend` `09cc1d2` — `dateAtMinutes`, `renderTimelineCreateSlots` in `scheduling-view.jsx`  
   - Not in feature HEAD, feature WT, or `test`

### P1 — stranded on `java-backend` only (not live UI)

2. **Appts Location / Staff / Client multi-select filters** (`locationFilterIds`, `ReportFilterMultiSelect`, `pruneSelectedIds`)  
3. **New Session modal supervising-provider rules** +  
   - `lib/authorization-units.js`  
   - `lib/authorization-billing-code.js` (java-side version)  
   - `lib/sort-clients.js`  
   - `backend/service-code-rules.php` (+ test twin) — **API already on live**, UI/modal wiring not  
4. Supporting: `lib/session-appointment-label.js`, `lib/session-notes-soap.js`, `client-assign-multi-select.jsx`

### P1 — stranded on `test` committed / feature WT only (not feature HEAD)

5. **Session Log Exclude→Misc** (`session_log_sync_misc_for_excluded` + `sessions_sync_misc_hrs_for_excluded_rendered`)  
   - On `test` @ `332aca5`  
   - Already copied into feature **working tree** (`backend` + `backend-test` session-log + scheduling_session_lib) — **not committed**  
   - Confirm live PHP deploys include WT version; if not, Exclude→Misc still broken in prod/test runtime

### P2 — Clearing House split across places

6. **Two parallel Clearing House implementations**  
   - Java: `clearing-house-view.jsx` + `clearing-house.php` + EDI migrations  
   - Feature WT: `clearing-house-settings.jsx` + `clearing-house-settings.php` + `20261010_120000_clearing_house_settings.sql`  
   - Live nav uses feature WT style; both PHP endpoints exist on Test+Prod APIs  
   - Needs a conscious pick / merge so you’re not maintaining two settings UIs

### P2 — uncommitted feature WT (risk of loss / half-deploy)

Not “missing from java,” but **not on any branch commit** — easy to lose:

| Area | Files (examples) |
|------|------------------|
| Clearing House settings | `components/master-data/clearing-house-settings.jsx`, `backend(-test)/clearing-house-settings.php`, migration `20261010_…` |
| Exclude→Misc port | `backend(-test)/session-log.php`, `scheduling_session_lib.php`, `add-session.php` |
| Office Ally / env | `officeally_config_helper.php`, `env.example` |
| Client configure / session notes | `add-client-*.jsx/js`, `OverviewTab.jsx`, `SessionNotesPanel.jsx`, … |
| Lib | `lib/aba-service-codes.js`, `lib/client-config-archive.js` (untracked), rbac keys, master-data-client-scope |
| Reports session log UI | `session-log-grid.jsx`, `session-log-table.jsx` |

---

## 5. Already good on live (both Dev + Prod)

Do **not** re-port these unless you see a regression:

- Claims Ready/Submitted + modern claims UI  
- Session Notes + Data Collection reports  
- Exclude Session admin column  
- Appts hover Data Collection (`ClipboardList` → `data-collection`)  
- Maintenance Period  
- Configure Data target fields (Clone, Gen Plan, Mastery Type, Target Status, Advanced Options, Skill Acquisition)

---

## 6. Divergence warning (do not merge branches wholesale)

| Direction | Problem |
|-----------|---------|
| `java-backend` → `feature-ui-routing` full merge | Would drop Data hover, Exclude Session report column, Maintenance Period, newer targets/claims |
| `test` → `feature-ui-routing` full merge | Would regress claims UI / target modal / configure-data that feature already advanced |
| Deploy from dirty WT | Live already looks like this — Clearing House + misc sync may be partially deployed without git history |

**Safe approach:** cherry-pick / surgical port of P0–P1 items into `feature-ui-routing`, commit the WT cleanup, then rebuild/deploy one coherent build.

---

## 7. Suggested fix order

1. **Commit or stash** current feature WT so Exclude→Misc + Clearing House settings aren’t only local.  
2. **Port time-row create** from `java-backend` into current `scheduling-view.jsx` (keep Data hover). Deploy UI → verify Dev then Prod.  
3. **Verify live PHP** has Exclude→Misc functions; if not, deploy `session-log.php` + `scheduling_session_lib.php` (+ `add-session.php`) from WT/`test`.  
4. Port multi-select filters + supervising modal (+ missing libs) from `java-backend`.  
5. Resolve Clearing House: keep settings **or** java view — not both indefinitely.

---

## Evidence

- Branch HEADs: feature `2ee5508`, java `3cea589`, test `332aca5`; merge-base `0da95f3`  
- Live UI probe: `/tmp/DEV_bundle.js` (~2.7MB), `/tmp/PROD_bundle.js` (~2.7MB), 2026-10-10  
- Three-way file matrix: 35 files differ on all three branches; 41 feature=test≠java; 15 java=test≠feature; 10 feature=java≠test  
