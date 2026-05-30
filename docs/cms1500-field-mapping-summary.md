# CMS-1500 Field Mapping Summary (Mahaverse)

This document summarizes:
- Which CMS-1500 fields are currently covered
- Which Mahaverse table/column each field maps from
- Which fields are missing or only inferred

## Covered Fields and Source Mapping

### Patient and Insured

- **Box 1 (Insurance Type)**  
  Source: `client_insurance.insurance_type`

- **Box 1a (Insured ID Number)**  
  Source: `client_insurance.insurance_id_number`

- **Box 2 (Patient Name)**  
  Source: `clients.first_name`, `clients.last_name` (and middle name when available)

- **Box 3 (Patient DOB / Sex)**  
  Source: `clients.date_of_birth`, `clients.gender`

- **Box 5 (Patient Address)**  
  Source (primary): `clients.address_line_1`, `clients.address_line_2`, `city`, `state`, `zipcode`.  
  Fallback: **`client_addresses`** — when fields on `clients` are blank, preview merges the first saved address row preferring rows with non-empty `address_line_1` (same helper applies to insured **Box 7** when “same as patient” is YES).  
  Alternate ZIP column on `clients`: `zip`, `postal_code` when `zipcode` is missing.

| # | Table | Columns (CMS-1500 mapping) |
|---|--------|---------------------------|
| 5 | `clients` | `address_line_1`, `address_line_2` (street); `city`, `state`, `zipcode` (locality); plus **`client_addresses`** merge when blank |
| 6 | `client_insurance` | `insured_same_as_client` (YES ⇒ mark **Self** in Box 6); else `insured_relationship` / `relationship_to_insured` (Spouse / Child / Other via PDF `rel_to_ins`). When insured ≠ patient: **`insured_address`** or **`insured_street`**; **`insured_zipcode`** or **`insured_zip`** |

- **Box 6 (Patient Relationship to Insured)**  
  Source: `client_insurance.insured_same_as_client` → when YES, **Self** is marked on the form (`rel_to_ins`).  
  Otherwise `insured_relationship` / `relationship_to_insured` is parsed for **Spouse** / **Child** / **Other** (keyword match). If same-as is NO and relationship is empty, Box 6 is left blank.

- **Box 10 (Condition related to …)**  
  Template has YES/NO pairs per row. **NO** is drawn (right checkbox) for `employment` (10a), `pt_auto_accident` (10b), `other_accident` (10c); `accident_place` cleared.

- **Box 11d (Another health benefit plan)**  
  **NO** is drawn on the right `ins_benefit_plan` checkbox.

- **Box 11 / 11a / 11c (Policy/Group/Plan details)**  
  Source: primarily `client_insurance` (`group_number`, insured detail fields, `insurance_plan_name`)

- **Box 12 (Patient Signature / Release)**  
  Source: `client_insurance.authorized_release_box12` → `pt_signature`; **Date** — `client_insurance.date_of_signature` → `pt_date` (falls back to claim generation date when release is YES and date is empty).

- **Box 13 (Insured Authorization)**  
  Source: `client_insurance.authorized_release_box13` → `ins_signature`

### Clinical and Claim Details

- **Box 21 (Diagnosis Codes)**  
  Source: **21A / first code** — all codes from `client_insurance.primary_diagnosis` first (in order), then unique additions from `diagnosis_1`..`diagnosis_5`.  
  Validation reference: `master_diagnosis`

- **Box 23 (Prior Authorization Number)**  
  Source candidates: `sessions.auth_code` and/or `client_auth.authorization_number`

- **Box 24A (Date(s) of Service)**  
  Source: `sessions.start_utc`, `sessions.end_utc`

- **Box 24B (Place of Service)**  
  Source: `sessions.place_of_service`

- **Box 24J (Rendering Provider NPI)**  
  Source: `staff.npiNumber` via `sessions.provider_id`

- **Box 26 (Patient Account Number)**  
  Source candidate: `sessions.session_id` (or claim/session identifier strategy)

- **Box 31 (Provider Signature / Date)**  
  Source: provider name from `sessions.supervising_provider_name` or `staff`; date from claim generation timestamp

### Facility and Billing Provider

- **Box 25 (Federal Tax ID)**  
  Source: `locations.tax_id_professional`

- **Box 32 (Service Facility Name/Address)**  
  Source: `locations.facility_name` + facility address fields

- **Box 32a (Service Facility NPI)**  
  Source: `locations.facility_npi_number`

- **Box 33 (Billing Provider Name/Address)**  
  Source: `locations.billing_provider_name` + billing address fields.  
  Fallback: When any billing_* field above is blank, preview copies **facility/legal** counterparts (`facility_name`, `facility_address`, `facility_city`, etc.) — common single-site setups.

- **Box 33a (Billing Provider NPI)**  
  Source: `locations.billing_npi_number`

- **Box 33b (Other ID / Taxonomy if required by payer)**  
  Source: `locations.taxonomy_code` (with qualifier formatting rules)

## Missing or Ambiguous Fields (Current Gaps)

The following are not fully modeled yet or are inferred:

- **Box 4 (Insured Name):** needs canonical mapping from insured-person columns
- **Box 7 (Insured Address):** depends on completeness of insured address fields
- **Box 10a/10b/10c (Condition Related):** no explicit structured flags; currently defaults
- **Box 11d (Other Health Benefit Plan):** not explicitly modeled
- **Box 14/15/16/18:** onset/illness/work/hospitalization dates not clearly represented in core claim flow
- **Box 17/17a/17b (Referring Provider):** no strong source in current session/client schema
- **Box 20 (Outside Lab):** not modeled
- **Box 22 (Resubmission Code / Original Ref):** not modeled
- **Box 24D (Procedure + Modifiers):** inferred from `sessions.auth_code`, `client_auth.billing_codes`, and/or `reports.service_code_with_modifiers`
- **Box 24E (Diagnosis Pointer per service line):** not stored line-by-line; must be computed
- **Box 24F (Charge):** not directly stored on sessions; derived from rate tables
- **Box 24G (Units):** derived from hours + unit rules, not stored as claim-ready units
- **Box 24C / 24H / 24I:** mostly default/derived formatting unless explicit fields are added
- **Box 27 (Accept Assignment):** available through `client_insurance.do_not_accept_assignment_box27` logic, needs normalization

## Important Data Model Caveat

- `sessions` does not reliably foreign-key directly to `locations.id` in all flows.
- For v1 CMS-1500 generation, requiring user-selected `location_id` at claim generation time is the safest approach for Boxes 25/32/33.

## Table-by-Table Mapping Reference

- **`clients`**: patient identity, DOB/sex, patient address
- **`client_insurance`**: insured/subscriber/policy/signature/diagnosis and CMS-related flags
- **`client_auth`**: authorization number and billing codes
- **`sessions`**: DOS/POS/provider/auth/session identifiers
- **`staff`**: provider identities and NPI
- **`locations`**: facility and billing provider blocks, tax ID, taxonomy
- **`master_diagnosis`**: diagnosis code reference
- **`master_assign_service_code` / `master_provider_service_code`**: unit/rate derivation inputs
- **`reports`** (optional/fallback): imported service codes with modifiers
