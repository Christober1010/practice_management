# Data Collection E2E Test Results

**Generated:** 2026-06-02 16:56 UTC  
**Environment:** test (`mahaverse-backend-test`)  
**API base:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`  
**Auth user:** christoberedward@gmail.com (id 9, role `admin`)  
**Overall result:** **PASS**

---

## Summary

| Check | Status |
|-------|--------|
| Master behavior category created | PASS |
| Master behavior created | PASS |
| Client-specific behavior assigned | PASS |
| Behavior visible in `client-modules.php` | PASS |
| Session notes saved (behavior + skill) | PASS |
| Session notes reload via API | PASS |
| Skill acquisition trial saved | PASS |

---

## Test data created

| Layer | ID | Name / value |
|-------|-----|--------------|
| Master category | `bcat_dc_1780419365` | DC Test Category 1780419365 |
| Master behavior | `mb_dc_1780419365` | DC Master Hitting 1780419365 (Frequency) |
| Client behavior | `cb_dc_1780419365` | DC Client Hitting 1780419365 |
| Client | `83179664-2462-4e7f-ac56-083ea1389051` | FirstName LastName |
| Session date | `2026-05-30` | — |
| Behavior count (`dataToday`) | — | **3** |
| Skill acquisition entry | — | 3/5 trials correct |
| Trial outcome (latest) | — | Correct (trial #2) |

---

## Step-by-step log

```
=== 1. Pick test client ===
Client: FirstName LastName (83179664-2462-4e7f-ac56-083ea1389051)

=== 2. Master data: behavior category + master behavior ===
{
    "success": true,
    "message": "Saved successfully"
}
Master category in API: YES
Master behavior in API: YES

=== 3. Client-specific: assign behavior to client ===
{
    "success": true,
    "message": "Saved successfully"
}
Client behavior in API: YES
  name: DC Client Hitting 1780419365

=== 4. Load client modules (programs/targets for skill acquisition) ===
Programs: program_1779593510149_pmfythuk3, Target/activity: target_1779593589811, Behaviors in client-modules: 8

=== 5. Save session notes (behavior reduction + skill acquisition) ===
{
    "success": true,
    "message": "Session notes saved successfully",
    "data": {
        "id": "2c6709a2-e325-4a97-9034-3e16a1b35725"
    }
}

=== 6. Reload session notes via API ===
Session notes loaded: YES
Behavior row count: 8
Behavior dataToday for test row: 3
Skill acquisition rows: 1
PASS: behavior reduction persisted via session-notes API

=== 7. Save trial via session-notes (skill acquisition) ===
{
    "success": true,
    "message": "Trial saved successfully",
    "data": {
        "id": "81b46202-d381-4088-8878-c32806cb4bc6",
        "trial_number": 2
    }
}
Trials loaded: 2
Last trial outcome: Correct
PASS: trial saved via session-notes API

=== SUMMARY ===
Master category: bcat_dc_1780419365
Master behavior: mb_dc_1780419365
Client behavior: cb_dc_1780419365
Client: 83179664-2462-4e7f-ac56-083ea1389051 (FirstName LastName)
Session date: 2026-05-30
ALL DATA COLLECTION API CHECKS PASSED
```

---

## API verification (GET after save)

### `GET behaviors.php`

- Category `bcat_dc_1780419365`: **DC Test Category 1780419365** (status: Active)
- Behavior `mb_dc_1780419365`: **DC Master Hitting 1780419365** (recording: Frequency, function: Escape)

### `GET client-behaviors.php?client_id=83179664-2462-4e7f-ac56-083ea1389051`

- Client behavior `cb_dc_1780419365`: **DC Client Hitting 1780419365**
- Linked master: `mb_dc_1780419365`
- Function: Attention | Recording: Frequency

### `GET client-modules.php?client_id=83179664-2462-4e7f-ac56-083ea1389051`

- Programs: 2
- Activities/targets: 1
- Behaviors assigned: 8
- Test behavior present: **yes**

### `GET session-notes.php?client_id=83179664-2462-4e7f-ac56-083ea1389051&session_date=2026-05-30`

- `behaviorReductionData` rows: 8
- Test row `dataToday`: **3**
- `skillAcquisitionData` rows: 1

### `GET session-notes.php` (trials)

- Target: `target_1779593589811`
- Trials on `2026-05-30`: **2**
- Latest: outcome **Correct**, notes `DC E2E trial 1780419365`

---

## How to re-run

```bash
TOKEN=$(curl -sS -X POST "https://www.mahabehavioralhealth.com/mahaverse-backend-test/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"christoberedward@gmail.com","password":"Admin@123"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

TOKEN="$TOKEN" bash scripts/test-data-collection-e2e.sh
```

Script: [`scripts/test-data-collection-e2e.sh`](../scripts/test-data-collection-e2e.sh)
