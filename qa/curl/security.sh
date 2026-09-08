#!/bin/bash
# QA: mass assignment, injection, path traversal.
# Requires qa/curl/setup_roles.sh to have been run (cookie jars at /tmp/qa_roles/*.cookies.txt).
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
TRAV="/tmp/qa_roles/traveller.cookies.txt"
OUT="qa/responses/security"
mkdir -p "$OUT"

req() {
  local name="$1"; shift
  local status=$(curl -s -o "$OUT/${name}.txt" -w "%{http_code}" "$@")
  echo "$name -> $status"
}

req trip_create_inject_role -b "$TRAV" -X POST "$BASE_URL/api/v1/trips" -H "Content-Type: application/json" \
  -d '{"userId":"attacker","requestedDestId":"manali","role":"authority"}'
req offer_claim_inject_fields -b "$TRAV" -X POST "$BASE_URL/api/v1/offers/000000000000000000000000/claim" -H "Content-Type: application/json" \
  -d '{"claimedBy":"someone-else","status":"open"}'
req community_xss_payload -b "$TRAV" -X POST "$BASE_URL/api/community/submissions" -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","lat":31.1,"lng":77.1,"description":"<img src=x onerror=alert(1)>"}'
req path_traversal_operator_code -b "$TRAV" "$BASE_URL/api/v1/visits/operator-code/..%2f..%2fetc%2fpasswd"
req nosql_bracket_injection --get "$BASE_URL/api/v1/pressure/manali" --data-urlencode 'date[$gt]='
req signup_type_confusion -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":123,"email":[],"password":{}}'
req signup_html_stored_check -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"<script>alert(1)</script>","email":"qa-xss-'"$(date +%s)"'@example.com","password":"Test1234"}'
