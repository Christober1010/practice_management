# Behavior Reduction — UI Test Plan

Manual test plan for the Behavior Reduction two-layer feature (master library → client assignment → session data collection).

**Environment:** `pnpm run dev:test` → `http://localhost:3000`  
**API base:** `https://www.mahabehavioralhealth.com/mahaverse-backend-test`

**Recommended test role:** Administrator (full RBAC), then repeat key smoke tests as a limited role (e.g. BCBA / RBT) if available.

---

## 0. Pre-flight checklist

Before UI testing, confirm these are deployed to **mahaverse-backend-test**:

| File | Why |
|------|-----|
| `behavior_helpers.php` | Session merge, CRUD helpers |
| `behaviors.php` | Master categories & behaviors API |
| `client-behaviors.php` | Client behaviors + ABC setup API |
| `session-notes.php` | Save/load session payload + structured behavior/ABC data |
| `client-modules.php` | Returns `behaviors` array on GET |

**SQL migrations run on test DB:**

- [ ] `20260524_193000_create-behavior-reduction-tables.sql`
- [ ] `20260524_195718_migrate_behavior_reduction_rbac.sql`

**Quick API smoke (browser Network tab or curl):**

- [ ] `GET …/behaviors.php` → `{ success: true, data: { categories, behaviors } }`
- [ ] `GET …/client-behaviors.php?client_id=<id>` → no CORS error from localhost; returns `{ success: true }`
- [ ] `GET …/session-notes.php?client_id=<id>&session_date=YYYY-MM-DD` → `200` (not blank `500`)

---

## 1. Test data to create

Use consistent names so steps are easy to follow:

| Item | Suggested value |
|------|-----------------|
| Category A | `Aggression` |
| Category B | `Self-Injury` |
| Generic behavior | `Hitting` — Frequency, category Aggression |
| Client | Any active client with a scheduled session (e.g. **Christober test**) |
| Client-specific behavior | `Client SIB` — Duration, assigned to test client |
| Session date | A date with a calendar session (e.g. `2026-05-24`) |

---

## 2. RBAC & navigation

| # | Steps | Expected |
|---|--------|----------|
| 2.1 | Log in as Administrator | Dashboard loads |
| 2.2 | Open sidebar **Data Collection** | Submenu expands |
| 2.3 | Confirm **Behavior Categories** and **Behaviors** appear | Both visible (requires `view.behavior_categories` / `view.behaviors` or manage equivalents) |
| 2.4 | Open **Admin → Role Access** | Behavior permission keys visible (`master_data.behavior_categories`, `master_data.behaviors`, view keys) |
| 2.5 | (Optional) Log in as restricted role without behavior keys | Sidebar items hidden; direct navigation blocked if enforced |

---

## 3. Master — Behavior Categories

**Path:** Sidebar → Data Collection → **Behavior Categories**

| # | Steps | Expected |
|---|--------|----------|
| 3.1 | Page load | Categories list loads (not stuck at “Categories (0)” when API has data) |
| 3.2 | Click **Add Category** | Centered modal; fields: Name, Description |
| 3.3 | Add `Aggression` with description | Toast success; row appears in table with Status **Active** |
| 3.4 | Add `Self-Injury` | Second row appears |
| 3.5 | Search “Agg” | Filters to Aggression |
| 3.6 | Edit Aggression description | Save succeeds; table updates |
| 3.7 | Archive a category (confirm dialog) | Row removed from active list; toast success |
| 3.8 | Refresh page | Active categories persist; archived stay hidden |

**Regression:** Categories with `archived: "0"` from API must display (string `"0"` must not hide rows).

---

## 4. Master — Behaviors (generic library)

**Path:** Sidebar → Data Collection → **Behaviors**

| # | Steps | Expected |
|---|--------|----------|
| 4.1 | Page load | Filters visible: search, view mode, client, category, recording type |
| 4.2 | Click **Add Behavior** | Modal opens; 2-column layout on wider screens |
| 4.3 | Create **generic** behavior: Name `Hitting`, Category `Aggression`, Recording **Frequency**, fill Goal/Function/Definition | **Assign to Client** = Generic (master library) |
| 4.4 | Save | Toast success; row in table with Source **Generic**, Active **Yes** |
| 4.5 | Create behavior with Recording **Duration** | Appears with correct recording type label |
| 4.6 | Toggle collection options (Do not zero out, Exclude from ABC) | Saves and reloads correctly on edit |
| 4.7 | Filter **Generic only** | Only master behaviors shown |
| 4.8 | Filter by category **Aggression** | Hitting visible; others hidden |
| 4.9 | Edit behavior name | Saves; list updates |
| 4.10 | Archive behavior | Removed from active list |

---

## 5. Master — Client-assigned behaviors

**Path:** Behaviors → **Add Behavior**

| # | Steps | Expected |
|---|--------|----------|
| 5.1 | Add behavior `Client SIB`, assign to test client, Recording **Duration** | Saves to client, not generic library |
| 5.2 | View mode **All** + client filter **All clients** | Client behavior appears with Source **Client** |
| 5.3 | Filter to specific client | Only that client’s behaviors |
| 5.4 | View mode **Client only** | Generic behaviors hidden |

---

## 6. Client profile — Behavior Reduction tab

**Path:** Clients → open test client → **Configure Data** (or equivalent) → **Behavior Reduction** tab

| # | Steps | Expected |
|---|--------|----------|
| 6.1 | Open Behavior Reduction tab | Behaviors list for client loads |
| 6.2 | **Manage Behaviors** / Add from library | Modal lists master behaviors; can add to client |
| 6.3 | Add `Hitting` from master if not already assigned | Appears in client behavior list |
| 6.4 | Add client-only behavior from modal | Saves under client |
| 6.5 | Archive/deactivate a client behavior | Removed from active list |

### ABC setup (same tab)

| # | Steps | Expected |
|---|--------|----------|
| 6.6 | Add antecedent `Demand placed` | Appears in antecedents list |
| 6.7 | Add consequence `Attention` | Appears in consequences list |
| 6.8 | Add location `Home` | Appears in locations list |
| 6.9 | Refresh / re-open client | ABC setup persists |

---

## 7. Session Notes — open & layout (UX)

**Path:** Scheduling → session for test client **or** Clients → Session Notes for that date

| # | Steps | Expected |
|---|--------|----------|
| 7.1 | Open Session Notes modal | Modal opens at ~90vh height |
| 7.2 | Scroll down through content | **Header stays fixed**: title, client badge, session date badge |
| 7.3 | Scroll further | **Data Collection / Session Notes tabs stay fixed** (do not scroll away) |
| 7.4 | On **Data Collection** tab | Sticky section pills visible: Trials · Skill Acquisition · Behavior Reduction · ABC Data |
| 7.5 | Scroll through sections | Active pill highlights current section |
| 7.6 | Click **Behavior Reduction** pill | Smooth scroll to that section |
| 7.7 | Switch to **Session Notes** tab | Sub-tabs (Overview, SOAP, etc.) stick while scrolling |
| 7.8 | Scroll to bottom on Session Notes tab | Save / Complete action bar remains accessible (sticky) |

---

## 8. Session Notes — data load & sync

| # | Steps | Expected |
|---|--------|----------|
| 8.1 | Open session for client **with behaviors configured**, **no prior save** for that date | Behavior Reduction section prefilled with active client behaviors (counts at 0) |
| 8.2 | Network: `client-modules.php` + `session-notes.php` load together | No race: behaviors not wiped after load |
| 8.3 | Network: `client-behaviors.php` | **No CORS error** from localhost |
| 8.4 | Open session for date **with saved notes** | Prior SOAP + behavior counts + ABC rows restore |
| 8.5 | Add new client behavior in Configure Data, re-open same session (without full page stale cache) | New behavior row appears; existing counts preserved |

---

## 9. Session Notes — Behavior Reduction data entry

Use a client with at least:
- One **Frequency** behavior (e.g. Hitting)
- One **Duration** behavior (e.g. Client SIB)
- Optional: Rate / Interval types if configured

| # | Steps | Expected |
|---|--------|----------|
| 9.1 | Go to **Behavior Reduction** section | Tabs or grouping by recording type |
| 9.2 | **Frequency** — increment count (+) | Count increases |
| 9.3 | **Frequency** — decrement (−) | Count does not go below 0 |
| 9.4 | **Duration** — start/stop timer (if UI present) | Seconds accumulate |
| 9.5 | **Manage Behaviors** from session | Modal opens; can add behaviors; list refreshes in session |
| 9.6 | Behavior marked **Exclude from ABC** | Still in Behavior Reduction; excluded from ABC behavior dropdown |

---

## 10. Session Notes — ABC data entry

| # | Steps | Expected |
|---|--------|----------|
| 10.1 | Go to **ABC Data** section | Antecedent / Behavior / Consequence / Location dropdowns populated from client ABC setup |
| 10.2 | Add ABC entry with all fields | Row appears in ABC table |
| 10.3 | Inline-add new antecedent/consequence/location (if available) | New option available in dropdown |
| 10.4 | Delete ABC row | Row removed from table |

---

## 11. Session Notes — save & reload

| # | Steps | Expected |
|---|--------|----------|
| 11.1 | Enter behavior counts + at least one ABC row | Data visible in UI |
| 11.2 | Session Notes tab → **SAVE** | Success toast; no error in Network (`session-notes.php` POST `success: true`) |
| 11.3 | Close modal | — |
| 11.4 | Re-open **same client + same date** | All behavior counts and ABC rows restored |
| 11.5 | Network: `GET session-notes.php?client_id=…&session_date=…` | HTTP **200** with `session_notes.behaviorReductionData` and `abcData` |
| 11.6 | Change frequency count, save again | Updated values on reload |

---

## 12. Session Notes — complete session (if applicable)

| # | Steps | Expected |
|---|--------|----------|
| 12.1 | Open session linked to a **real calendar session** (valid `session_id`) | — |
| 12.2 | Fill required notes/signatures per your workflow | — |
| 12.3 | Click **COMPLETE** | Success toast; billing/claim message if configured |
| 12.4 | Re-open same date | Saved data still present |

**Negative:** Complete without linked schedule session → clear error message (not silent failure).

---

## 13. Recording type rules

| # | Steps | Expected |
|---|--------|----------|
| 13.1 | Edit behavior **without** session data collected | Recording type can change |
| 13.2 | Collect session data for a behavior, save, reload | Recording type **locked** on edit (UI + API reject change) |

---

## 14. Edge cases & regression

| # | Steps | Expected |
|---|--------|----------|
| 14.1 | Client with **no behaviors** | Behavior Reduction shows empty/manage prompt; no JS errors |
| 14.2 | Client with **no ABC setup** | ABC section still usable; inline add works |
| 14.3 | Archived master behavior | Not shown in session prefill |
| 14.4 | Inactive client behavior (`is_active = 0`) | Not shown in session prefill |
| 14.5 | Two categories named similarly | Search and filter still work |
| 14.6 | Hard refresh on Behavior Categories page | List matches API (not empty when API has rows) |
| 14.7 | Session date with corrupt/old payload | Graceful load or JSON error message (not blank 500) |

---

## 15. API endpoints reference (Network tab)

Useful when debugging UI issues:

| Action | Method | Endpoint |
|--------|--------|----------|
| Master categories + behaviors | GET | `/behaviors.php` |
| Save master category/behavior | POST | `/behaviors.php` |
| Archive master item | DELETE | `/behaviors.php` |
| Client behaviors + ABC setup | GET | `/client-behaviors.php?client_id=` |
| Save client behavior / ABC | POST | `/client-behaviors.php` |
| Client modules (includes behaviors) | GET | `/client-modules.php?client_id=` |
| Load session notes | GET | `/session-notes.php?client_id=&session_date=` |
| Save session notes | POST | `/session-notes.php` |

Auth headers (`Authorization`, `X-Auth-Token`) are sent on session-notes and client-modules calls — CORS must allow `X-Auth-Token`.

---

## 16. Sign-off checklist

| Area | Tester | Pass | Notes |
|------|--------|------|-------|
| RBAC / sidebar | | ☐ | |
| Behavior categories CRUD | | ☐ | |
| Generic behaviors CRUD | | ☐ | |
| Client-assigned behaviors | | ☐ | |
| Client ABC setup | | ☐ | |
| Session modal UX (sticky chrome) | | ☐ | |
| Session behavior prefill & sync | | ☐ | |
| Frequency / Duration entry | | ☐ | |
| ABC entry | | ☐ | |
| Save & reload same date | | ☐ | |
| CORS / 500 fixes on test API | | ☐ | |

---

## Known issues fixed in this branch (verify)

- [ ] Categories/behaviors hidden when API returns `archived: "0"` (string)
- [ ] `DeleteConfirmModal` import on Behavior Categories page
- [ ] Client behaviors not listed in Behaviors page “All” view until client filter selected
- [ ] CORS on `client-behaviors.php` missing `X-Auth-Token`
- [ ] `session-notes.php` 500 when saved entry exists (missing `br_merge_behavior_data_into_rows` on server)
- [ ] Session notes race between client-modules load and saved payload load
- [ ] Session modal header/tabs scrolling away on long content

---

*Last updated: May 2026 — Behavior Reduction two-layer implementation*
