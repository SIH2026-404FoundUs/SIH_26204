#!/bin/bash
# QA: role escalation + unauthenticated access to every protected endpoint.
# Requires cookie jars from setup_roles.sh at /tmp/qa_roles/{role}.cookies.txt
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
TRAV="/tmp/qa_roles/traveller.cookies.txt"
OP="/tmp/qa_roles/operator.cookies.txt"
AUTH="/tmp/qa_roles/authority.cookies.txt"

req() {
  local name="$1"; shift
  local status=$(curl -s -o "/tmp/qa_role_${name}.txt" -w "%{http_code}" "$@")
  echo "$name -> $status"
}

echo "=== authority-only endpoints, called by lower roles ==="
req "ingest_alert_by_traveller" -b "$TRAV" -X POST "$BASE_URL/api/v1/alerts" -H "Content-Type: application/json" -d '{"destId":"manali","kind":"weather","body":"x","sourceUrl":"https://x.com","sourceName":"x","validTo":"2027-01-01"}'
req "ingest_alert_by_operator" -b "$OP" -X POST "$BASE_URL/api/v1/alerts" -H "Content-Type: application/json" -d '{"destId":"manali","kind":"weather","body":"x","sourceUrl":"https://x.com","sourceName":"x","validTo":"2027-01-01"}'
req "ingest_alert_by_authority" -b "$AUTH" -X POST "$BASE_URL/api/v1/alerts" -H "Content-Type: application/json" -d '{"destId":"manali","kind":"weather","body":"x","sourceUrl":"https://x.com","sourceName":"x","validTo":"2027-01-01"}'
req "ingest_alert_unauthenticated" -X POST "$BASE_URL/api/v1/alerts" -H "Content-Type: application/json" -d '{"destId":"manali","kind":"weather","body":"x","sourceUrl":"https://x.com","sourceName":"x","validTo":"2027-01-01"}'

req "queued_submissions_by_traveller" -b "$TRAV" "$BASE_URL/api/community/submissions/queued"
req "queued_submissions_by_operator" -b "$OP" "$BASE_URL/api/community/submissions/queued"
req "queued_submissions_by_authority" -b "$AUTH" "$BASE_URL/api/community/submissions/queued"
req "queued_submissions_unauthenticated" "$BASE_URL/api/community/submissions/queued"

req "review_submission_by_traveller" -b "$TRAV" -X POST "$BASE_URL/api/community/submissions/000000000000000000000000/review" -H "Content-Type: application/json" -d '{"action":"approve"}'

echo ""
echo "=== operator/authority-only endpoints, called by traveller ==="
req "create_offer_by_traveller" -b "$TRAV" -X POST "$BASE_URL/api/v1/offers" -H "Content-Type: application/json" -d '{"businessId":"x","destId":"manali","date":"2027-01-01"}'
req "create_offer_unauthenticated" -X POST "$BASE_URL/api/v1/offers" -H "Content-Type: application/json" -d '{"businessId":"x","destId":"manali","date":"2027-01-01"}'

echo ""
echo "=== every protected endpoint, unauthenticated ==="
req "visits_verify_unauth" -X POST "$BASE_URL/api/v1/visits/verify" -H "Content-Type: application/json" -d '{"businessId":"x","code":"123456"}'
req "community_submit_unauth" -X POST "$BASE_URL/api/community/submissions" -H "Content-Type: application/json" -d '{"name":"x","lat":1,"lng":1}'
req "offer_claim_unauth" -X POST "$BASE_URL/api/v1/offers/000000000000000000000000/claim"
req "waitlist_create_unauth" -X POST "$BASE_URL/api/v1/waitlist" -H "Content-Type: application/json" -d '{"destId":"manali","windowFrom":"2027-01-01","windowTo":"2027-01-05"}'
req "waitlist_mine_unauth" "$BASE_URL/api/v1/waitlist/mine"
req "waitlist_delete_unauth" -X DELETE "$BASE_URL/api/v1/waitlist/000000000000000000000000"
req "safety_share_unauth" -X POST "$BASE_URL/api/v1/safety/trips/share" -H "Content-Type: application/json" -d '{"tripId":"x","destId":"manali","startDate":"2027-01-01","endDate":"2027-01-02"}'
req "safety_share_revoke_unauth" -X POST "$BASE_URL/api/v1/safety/trips/share/faketoken/revoke"
req "safety_complaints_unauth" -X POST "$BASE_URL/api/v1/safety/complaints" -H "Content-Type: application/json" -d '{"destId":"manali","text":"x"}'
req "safety_complaints_mine_unauth" "$BASE_URL/api/v1/safety/complaints/mine"
req "auth_check_unauth" "$BASE_URL/api/auth/check"

echo ""
echo "=== path/body ID-tampering (own userId vs someone else's) ==="
req "waitlist_mine_as_traveller_sees_only_own" -b "$TRAV" "$BASE_URL/api/v1/waitlist/mine"
req "complaints_mine_as_operator_sees_only_own" -b "$OP" "$BASE_URL/api/v1/safety/complaints/mine"

echo "Done."
