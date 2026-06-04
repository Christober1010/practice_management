#!/usr/bin/env bash
# End-to-end data collection smoke test (master + client + session save/load).
# Usage: TOKEN=... bash scripts/test-data-collection-e2e.sh
set -euo pipefail

BASE="${MAHAVERSE_API_BASE_TEST:-https://www.mahabehavioralhealth.com/mahaverse-backend-test}"
BASE="${BASE%/}"
TOKEN="${TOKEN:?Set TOKEN}"
TS="$(date +%s)"
SESSION_DATE="${SESSION_DATE:-2026-05-30}"

# IONOS strips Authorization on many PHP hosts; X-Auth-Token is reliable.
auth_hdr=(-H "X-Auth-Token: $TOKEN" -H "Content-Type: application/json")

api_get() {
  curl -sS "${auth_hdr[@]}" "$BASE/$1"
}

api_post() {
  curl -sS -X POST "${auth_hdr[@]}" -d "$2" "$BASE/$1"
}

echo "=== 1. Pick test client ==="
CLIENTS_JSON="$(api_get get-clients.php)"
CLIENT_ID="$(echo "$CLIENTS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
clients=d.get('clients') or []
if not clients:
    sys.exit('no clients')
print(clients[0]['client_id'])
")"
CLIENT_NAME="$(echo "$CLIENTS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
c=d['clients'][0]
print((c.get('first_name','')+' '+c.get('last_name','')).strip())
")"
echo "Client: $CLIENT_NAME ($CLIENT_ID)"

CAT_ID="bcat_dc_${TS}"
MASTER_BEH_ID="mb_dc_${TS}"
CLIENT_BEH_ID="cb_dc_${TS}"

echo ""
echo "=== 2. Master data: behavior category + master behavior ==="
MASTER_RESP="$(api_post behaviors.php "$(cat <<EOF
{
  "categories": [{
    "id": "$CAT_ID",
    "name": "DC Test Category $TS",
    "description": "E2E data collection test",
    "status": "Active",
    "archived": 0
  }],
  "behaviors": [{
    "id": "$MASTER_BEH_ID",
    "category_id": "$CAT_ID",
    "name": "DC Master Hitting $TS",
    "goal_name": "Reduce hitting",
    "function": "Escape",
    "definition": "Any instance of hand making forceful contact",
    "recording_type": "Frequency",
    "is_active": 1,
    "status": "Active",
    "archived": 0
  }]
}
EOF
)")"
echo "$MASTER_RESP" | python3 -m json.tool 2>/dev/null || echo "$MASTER_RESP"

VERIFY_MASTER="$(api_get behaviors.php)"
echo "$VERIFY_MASTER" | python3 -c "
import json,sys
d=json.load(sys.stdin)
cats=[c for c in d['data']['categories'] if '$CAT_ID' in c.get('id','')]
beh=[b for b in d['data']['behaviors'] if '$MASTER_BEH_ID' in b.get('id','')]
print('Master category in API:', 'YES' if cats else 'NO')
print('Master behavior in API:', 'YES' if beh else 'NO')
if not cats or not beh: sys.exit(1)
"

echo ""
echo "=== 3. Client-specific: assign behavior to client ==="
CLIENT_BEH_RESP="$(api_post client-behaviors.php "$(cat <<EOF
{
  "client_id": "$CLIENT_ID",
  "behaviors": [{
    "id": "$CLIENT_BEH_ID",
    "master_behavior_id": "$MASTER_BEH_ID",
    "category_id": "$CAT_ID",
    "name": "DC Client Hitting $TS",
    "goal_name": "Reduce client hitting",
    "function": "Attention",
    "definition": "Client-specific hitting definition",
    "recording_type": "Frequency",
    "is_active": 1,
    "status": "Active",
    "archived": 0
  }]
}
EOF
)")"
echo "$CLIENT_BEH_RESP" | python3 -m json.tool 2>/dev/null || echo "$CLIENT_BEH_RESP"

VERIFY_CLIENT_BEH="$(api_get "client-behaviors.php?client_id=${CLIENT_ID}")"
echo "$VERIFY_CLIENT_BEH" | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=[b for b in d['data']['behaviors'] if '$CLIENT_BEH_ID' in b.get('id','')]
print('Client behavior in API:', 'YES' if rows else 'NO')
if not rows: sys.exit(1)
print('  name:', rows[0].get('name'))
"

echo ""
echo "=== 4. Load client modules (programs/targets for skill acquisition) ==="
MODULES_JSON="$(api_get "client-modules.php?client_id=${CLIENT_ID}")"
TARGET_ID="$(echo "$MODULES_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
acts=d.get('data',{}).get('activities') or []
if not acts:
    print('')
else:
    print(acts[0].get('id',''))
")"
PROGRAM_ID="$(echo "$MODULES_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
progs=d.get('data',{}).get('programs') or []
print(progs[0].get('id','') if progs else '')
")"
BEH_COUNT="$(echo "$MODULES_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(len(d.get('data',{}).get('behaviors') or []))
")"
echo "Programs: ${PROGRAM_ID:-none}, Target/activity: ${TARGET_ID:-none}, Behaviors in client-modules: $BEH_COUNT"

echo ""
echo "=== 5. Save session notes (behavior reduction + skill acquisition) ==="
SKILL_JSON='[]'
if [[ -n "$TARGET_ID" ]]; then
  SKILL_JSON="$(python3 -c "
import json
print(json.dumps([{
  'id': 'skill_${TS}',
  'programId': '${PROGRAM_ID}',
  'programName': 'DC Test Program',
  'targetId': '${TARGET_ID}',
  'targetName': 'DC Test Target',
  'value': '3/5 trials correct',
  'savedAt': '2026-05-30T12:00:00.000Z'
}]))
")"
fi

SAVE_RESP="$(api_post session-notes.php "$(cat <<EOF
{
  "client_id": "$CLIENT_ID",
  "session_date": "$SESSION_DATE",
  "session_notes": {
    "soapDate": "$SESSION_DATE",
    "behaviorReductionData": [{
      "id": "$CLIENT_BEH_ID",
      "behaviorName": "DC Client Hitting $TS",
      "recordingType": "Frequency",
      "dataToday": 3,
      "durationSeconds": 0,
      "rateCount": 0,
      "intervalMarks": [],
      "savedAt": "2026-05-30T12:00:00.000Z"
    }],
    "skillAcquisitionData": $SKILL_JSON,
    "abcData": []
  }
}
EOF
)")"
echo "$SAVE_RESP" | python3 -m json.tool 2>/dev/null || echo "$SAVE_RESP"
echo "$SAVE_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)"

echo ""
echo "=== 6. Reload session notes via API ==="
LOAD_RESP="$(api_get "session-notes.php?client_id=${CLIENT_ID}&session_date=${SESSION_DATE}")"
echo "$LOAD_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('success'), d
notes=(d.get('data') or {}).get('session_notes') or {}
br=notes.get('behaviorReductionData') or []
sk=notes.get('skillAcquisitionData') or []
br_hit=[r for r in br if '$CLIENT_BEH_ID' in str(r.get('id',''))]
print('Session notes loaded: YES')
print('Behavior row count:', len(br))
print('Behavior dataToday for test row:', br_hit[0].get('dataToday') if br_hit else 'MISSING')
print('Skill acquisition rows:', len(sk))
if not br_hit or int(br_hit[0].get('dataToday') or 0) != 3:
    sys.exit('behavior reduction data not persisted correctly')
print('PASS: behavior reduction persisted via session-notes API')
"

if [[ -n "$TARGET_ID" ]]; then
  echo ""
  echo "=== 7. Save trial via session-notes (skill acquisition) ==="
  TRIAL_RESP="$(api_post session-notes.php "$(cat <<EOF
{
  "client_id": "$CLIENT_ID",
  "target_id": "$TARGET_ID",
  "session_date": "$SESSION_DATE",
  "trial_outcome": "Correct",
  "notes": "DC E2E trial $TS"
}
EOF
)")"
  echo "$TRIAL_RESP" | python3 -m json.tool 2>/dev/null || echo "$TRIAL_RESP"
  TRIALS_LOAD="$(api_get "session-notes.php?client_id=${CLIENT_ID}&target_id=${TARGET_ID}&session_date=${SESSION_DATE}")"
  echo "$TRIALS_LOAD" | python3 -c "
import json,sys
d=json.load(sys.stdin)
trials=d.get('data') or []
print('Trials loaded:', len(trials))
if not trials: sys.exit('no trials saved')
last=trials[-1]
print('Last trial outcome:', last.get('trial_outcome'))
print('PASS: trial saved via session-notes API')
"
else
  echo ""
  echo "=== 7. Skipped trial test (no client target/activity on this client) ==="
fi

echo ""
echo "=== SUMMARY ==="
echo "Master category: $CAT_ID"
echo "Master behavior: $MASTER_BEH_ID"
echo "Client behavior: $CLIENT_BEH_ID"
echo "Client: $CLIENT_ID ($CLIENT_NAME)"
echo "Session date: $SESSION_DATE"
echo "ALL DATA COLLECTION API CHECKS PASSED"
