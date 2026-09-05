# Session import test workbooks

Theralytics / CL_PA_RPT Excel files to exercise:

1. **Create** new sessions  
2. **Exclude Session** column (create + re-import No↔Yes update)  
3. **Within-file duplicates** (client + DOS + start + service code)  
4. **DB duplicates**  
5. **Scheduled → Rendered** re-import update  

## Files

| File | Purpose |
|------|---------|
| `pass1-create-exclude-duplicates.xlsx` | First import |
| `pass2-scheduled-to-rendered.xlsx` | Second import (after Pass 1) |
| `build-test-excels.js` | Regenerates both workbooks |
| `identity.placeholder.json` | Shows current placeholder identity |

## Before you import — replace identity

Placeholders match `docs/session-calendar-sample-import.xlsx`:

- Client: `FirstName LastName`
- Staff: `Mani rbt`
- Auth: `Auth1234`
- Service code: `97151`
- DOS: **2026-11-10** (all rows)

Edit `IDENTITY` in `build-test-excels.js` to a **real** client / staff / auth in your DB, then:

```bash
node docs/session-import-cases/build-test-excels.js
```

Or edit the Excel cells directly (keep DOS / times as-is so case pairing still works).

## How to run

1. Scheduling → **Import Sessions** (or Reports → Session Log → Import).
2. Upload **Pass 1** → **Validate rows** → check expectations → **Import**.
3. Upload **Pass 2** → Validate → Import.
4. Confirm calendar on **2026-11-10**.

---

## Pass 1 — expected results

| Row | Case (in Notes) | Time | Status | Exclude | Expect |
|-----|-----------------|------|--------|---------|--------|
| 1 | `CASE1_CREATE_OK` | 08:00 | Scheduled | No | **Create** |
| 2 | `CASE2_EXCLUDE_YES` | 09:00 | Scheduled | **Yes** | **Create**, `exclude_session=Yes` |
| 3 | `CASE3_WITHIN_DUP_KEEP` | 10:00 | Scheduled | No | **Create** |
| 4 | `CASE4_WITHIN_DUP_REJECT` | 10:00 | Scheduled | No | **Reject** — in-file duplicate of row 3 |
| 5 | `CASE5_CREATE_FOR_UPGRADE` | 14:00 | Scheduled | No | **Create** (used by Pass 2) |
| 6 | `CASE6_CREATE_SECOND_OK` | 15:00 | Scheduled | No | **Create** |

Validate: ~**5 ready** / 6 total (row 4 error).  
Import: **imported ≈ 5**, **updated = 0**.

---

## Pass 2 — expected results (after Pass 1 imported)

| Row | Case | Time | Status | Expect |
|-----|------|------|--------|--------|
| 1 | `CASE7_UPGRADE_TO_RENDERED` | 14:00 | **Rendered** | **Update** Scheduled→Rendered (same key as CASE5) |
| 2 | `CASE8_DB_DUP_STILL_SCHEDULED` | 08:00 | Scheduled | **Reject** — DB duplicate of CASE1 |
| 3 | `CASE9_ALREADY_RENDERED_DUP` | 14:00 | Rendered | **Reject** — already Rendered after row 1 (not Scheduled→Rendered) |
| 4 | `CASE10_CREATE_NEW_AFTER` | 16:00 | Scheduled | **Create** |

Validate: row 1 shows **Update (→ Rendered)**; rows 2–3 errors; row 4 Ready.  
Import: **updated ≈ 1**, **imported ≈ 1**.

---

## Quick checks after import

- CASE2 session: **Exclude session = Yes** (admin view).
- Re-import same row with **Exclude Session=No** (or Yes→No): updates existing appointment; does not create a second session.
- Re-import with the same Exclude value and same status: still **Reject** as DB duplicate (unless Scheduled→Rendered).
- CASE5 / CASE7: same session id, status **Rendered**, rendered hours filled.
- CASE4 / CASE8 / CASE9: never created as extra sessions.
- Calendar for `2026-11-10` has sessions at 08:00, 09:00, 10:00, 14:00, 15:00, 16:00 (not two at 10:00).

## Cleanup

Delete the 2026-11-10 test sessions for that client when finished.
