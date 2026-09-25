# Untitled-1 feature verify — backend-test — 2026-09-23

**API base:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`  
**Auth:** E2E admin (`role=admin`)  
**Constraint:** No Office Ally / Availity claim submit calls

## Verdict

**Backend-test deploy looks good** for the new/changed PHP endpoints and target meta storage path. Frontend-only pieces (Claims status dropdown UI, Maintenance Period sidebar, Advanced Options form) still need a `dev:test` UI pass.

## Results

| # | Item | Check | Result |
|---|------|--------|--------|
| 1 | Session Notes columns | `reports-session-notes.php` returns `dos`, `client_name`, `staff`, `billing_code`, `session_id` | **PASS** (13 rows / 90d) |
| 1 | Exclude Session = Yes Admin-only | Admin sees `exclude_session=Yes` rows | **PASS** (2 visible: sessions 790, 791) |
| 1 | Exclude Session non-admin | Biller/staff credential not in `e2e/.env` | **SKIP** |
| 2 | Claims Ready / Submitted data | `add-session.php` in 30d window | **PASS** (14 Ready to Bill; 0 Submitted in window — filter still viable) |
| 2 | Claims status UI dropdown | Frontend-only | **SKIP** (API data OK) |
| 3–5,7–8 | Target SD / Gen plan / Mastery / Status / Advanced | Create DTT target with encoded instructions + meta; reload + parse | **PASS** |
| 6 | Maintenance Period API | OPTIONS 204, GET 401 unauth, auth list seeds 9 periods | **PASS** |
| 6 | Maintenance Period CRUD | Create → Update → Archive | **PASS** |

## Sample evidence

### Maintenance periods (seeded)

Daily, Every Other Day, Weekly, Every Other Week, Bi-Weekly, Bi-Monthly, Monthly, Quarterly, Annually

### Session Notes row shape

```
dos=2026-09-21
client_name=Jovana Radicevic
staff=Harini Dev
billing_code=97156 - 0317T1PTH-...
session_id=797
exclude_session=No
```

### Target meta roundtrip

```
sd=E2E SD cue
generalizationPlan=Practice across home and clinic
mastery_type=Manual
target_status=Baseline
maintenance_level=Weekly
date_opened=2026-09-16
activityType=Discrete Trial Training
```

Created as `e2e_tgt_*` then archived.

## UI verification (localhost:3000 → backend-test) — 2026-09-23

| # | UI check | Result |
|---|----------|--------|
| 1 | Session Notes table headers DOS / Client / Staff / Billing Code / Session ID; Rendered rows show real data | **PASS** |
| 2 | Claims → Claim status dropdown: Ready to Bill, Submitted, Ready to Bill & Submitted; Submitted → empty message | **PASS** |
| 6 | Configure data → Maintenance Period submenu; list shows 9 seeded frequencies + Add period | **PASS** |
| 3–5,7–8 | Add Target modal: SD, Generalization Plan, Mastery Type, Target Status, Advanced Options dates, Override Mastery Criterion (+ DTT/TA hint), Maintenance Level options from API | **PASS** |
| 5,8 | Targets list columns Mastery Type + Target Status (visible at wide viewport) | **PASS** |

## Gaps / next

1. Add a non-admin E2E user to confirm Exclude Session rows are hidden in UI.
2. No Submitted claims in the recent DOS window on test — filter UI works; data branch empty (expected).
