# Missing changes — recheck after local browser verify (2026-10-11)

Updated after local `pnpm dev:test` (`http://localhost:3000`) checks + live Dev/Prod static-bundle probes.

Compares:

- `feature-ui-routing` @ `6f327a4` (committed + pushed; matches `origin/feature-ui-routing`)
- **staged WT only** (Insurance Utilization hours port — not committed)
- `test` @ `332aca5` (same util hours UI content as staged WT)
- `java-backend` @ `3cea589` (historical scatter source; scheduling pieces now absorbed into feature)
- **live** Dev (`mahaverse-dev.mahabehavioralhealth.com`) and Prod (`mahaverse.mahabehavioralhealth.com`)

---

## Executive summary

| Area | Verdict |
|------|---------|
| Scheduling / supervising / auth windows | **In feature HEAD `6f327a4` and on live Dev + Prod UI** (time-row create, multi-select filters, Scheduled Hours, supervising labels). |
| Insurance Utilization hours model | **Live Dev YES (verified 2026-10-11 evening)** · feature staged WT / `test` YES · feature HEAD may still be uncommitted · **Prod UI not rechecked after this deploy**. |
| Branch scatter (appts) | Largely resolved by `6f327a4`; remaining gap is **util hours** (+ one supervising auto-fill bug). |
| Git | Do **not** commit/push unless asked — util remains staged only. |

---

## 1. Local browser verification (2026-10-11, Christo admin)

Environment: `localhost:3000` → backend-test.

### Appointments — PASS (with one bug)

| Check | Result |
|-------|--------|
| Time-grid “Add session at 10:00 AM” opens create form | **PASS** |
| Start prefilled `2026-10-11T10:00`; Scheduled Hours `1.00` | **PASS** |
| Provider list loads (`staff.php` path) — 40 options; Mani rbt selectable | **PASS** |
| Location / Staff / Client multi-select filters present (“All locations…”) | **PASS** |
| 97153 → label “staff assigned supervisor”; value **Harini Dev (BCBA)** | **PASS** |
| 97155 → label “same as Provider for this billing code” | **PASS** |
| 97155 → supervising value switches to **Mani rbt (RBT)** | **FAIL** — stays Harini after 97153→97155 (and after wait / re-switch). Label updates; value does not. Likely Strict Mode / `lastAutoSupervisingRef` mutate-inside-`setForm` race in `new-session-form-modal.jsx`. |
| Session date outside auth window (2029-06-01 vs auth ending 2027) | **PASS** — inline: “Session date is outside this authorization’s start/end dates”; form stays open |

### Insurance Utilization — PASS locally (staged code)

| Check | Result |
|-------|--------|
| Nav → Insurance Utilization | **PASS** |
| Table headers include Completed Hrs / Scheduled Hrs / Remaining Hours / Weekly Target Hrs (+ Approved in Units, Hrs) | **PASS** |
| Row load | **PASS** — 177 authorization rows |
| Summary cards still say Approved / Consumed / Remaining **units** | Expected in current port (hours are table-level) |

---

## 2. Live Dev vs live Prod (static JS probe 2026-10-11)

Page chunks: Dev `page-be1f5eed…` · Prod `page-75026488…` (different hashes; **same feature markers** below).

| Marker | Dev | Prod |
|--------|-----|------|
| `Add session at` (time-row create) | YES | YES |
| `locationFilterIds` (appts multi-select) | YES | YES |
| `Scheduled Hours` | YES | YES |
| Supervising copy (`same as Provider` / `staff assigned supervisor`) | YES | YES |
| Clearing House | YES | YES |
| Exclude Session | YES | YES |
| **Completed Hrs / Scheduled Hrs / Remaining Hours / Weekly Target Hrs** (util table) | **YES** (recheck 2026-10-11 eve, page `705f74ab…`) | **NO** (last probe before Dev-only deploy) |
| Approved units (util summary-era copy) | YES | YES |

Backend: `reports-insurance-utilization.php` present on test + prod APIs (OPTIONS → 204). Hours **UI columns** are what live is missing; confirm whether deployed PHP already emits `completed_hours` / `scheduled_hours` / `remaining_hours` when the new UI ships.

---

## 3. Feature matrix (updated)

| Item | feature HEAD `6f327a4` | feature staged WT | test | java | live Dev | live Prod |
|------|:---------------------:|:-----------------:|:----:|:----:|:--------:|:---------:|
| Time-row create appointment | YES | YES | NO* | YES | **YES** | **YES** |
| Appts multi-select filters | YES | YES | NO* | YES | **YES** | **YES** |
| New session supervising rules + Scheduled Hours | YES | YES | NO* | partial | **YES** | **YES** |
| Auth date / units hardening (PHP + modal) | YES | YES | NO* | NO | YES‡ | YES‡ |
| Clearing House **settings** | YES | YES | NO | NO | YES | YES |
| Session Log Exclude→Misc | YES | YES | YES | lib only | YES‡ | YES‡ |
| **Insurance Util hours columns** | **NO*** | **YES (staged)** | **YES** | NO | **YES** | **NO†** |
| 97155 supervising value auto-sync | buggy | buggy | n/a | n/a | likely same | likely same |

\* `test` HEAD never received the appts port; feature absorbed it in `6f327a4`. Feature HEAD util file may still lack hours until the staged commit lands — Dev was deployed from WT/build anyway.  
† Prod util hours not redeployed as of Dev verify; re-probe after Prod ship.  
‡ Live UI strings / prior deploy checks; PHP byte-identical to HEAD not re-diffed on server today.

---

## 4. Actually missing now

### P0 — commit + deploy gap

1. **Insurance Utilization hours model**  
   - **Dev verified 2026-10-11:** table headers + 177 rows with Completed/Scheduled/Remaining Hours / Weekly Target Hrs (sample Erwin Rivera 97151: 6 completed hrs).  
   - Still **staged only** in git (not in `6f327a4`) — commit when approved so Dev isn’t ahead of the branch.  
   - **Prod** still needs the same UI (+ PHP) deploy and smoke.

### P1 — bug found in local verify (likely live too)

2. **97155 supervising provider value does not replace 97153 staff supervisor**  
   - Label flips correctly; combobox value stays on assigned BCBA  
   - File: `components/scheduling/new-session-form-modal.jsx` (`lastAutoSupervisingRef` updated inside `setForm` updater — Strict Mode can strand the ref)  
   - **Action:** fix auto-fill (move ref write out of updater / reset on billing-rule change), retest 97153↔97155, redeploy UI

### P2 — hygiene

3. **`Launchpad/` untracked nested tree** — keep out of Mahaverse commits  
4. Clearing House: live uses **settings** path from feature; java’s separate `clearing-house-view.jsx` remains unused on feature — leave unless product wants EDI view  
5. Util summary cards still unit-denominated while the table is hours — confirm product intent before polish

---

## 5. No longer missing (resolved by `6f327a4` + live deploy)

Do **not** re-port from `java-backend` / treat as stranded:

- Time-row create (`renderTimelineCreateSlots` / `Add session at`)
- Appts Location / Staff / Client multi-select
- Supervising-provider modal wiring + `service-code-rules` + seed migrations
- Scheduled Hours field
- Auth window / units messaging (date-out-of-range verified locally)
- Clearing House settings UI/API
- Exclude→Misc session-log sync (in same commit)
- Supporting libs: `sort-clients`, `authorization-units`, `session-appointment-label`, `session-notes-soap`, `client-assign-multi-select`, etc.

---

## 6. Suggested fix order

1. Fix 97155 supervising auto-fill bug; quick local retest of 97153↔97155.  
2. When ready to ship util: **commit** the four staged util/e2e files (exclude `Launchpad/`), deploy UI + `reports-insurance-utilization.php` (prod + test).  
3. Live smoke: Insurance Utilization headers = Completed / Scheduled / Remaining Hours / Weekly Target Hrs; spot-check one client row vs backend-test.  
4. Optional: align util summary cards to hours if product wants consistency.

---

## Evidence

- Feature / origin HEAD: `6f327a4` — *Harden scheduling auth windows and supervising rules for appointments.*  
- Local verify: Appointments + Insurance Utilization on `localhost:3000` (Christo), 2026-10-11  
- Live bundles: `/tmp/live_probe_httpsmahaversedev…js`, `/tmp/live_probe_httpsmahaverse…js`  
- Staged-only util: `git status` shows 4 staged paths; `Launchpad/` untracked
