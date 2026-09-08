#!/bin/bash
# QA: AI service tested directly (not through frontend, not through backend).
set -uo pipefail
AI_URL="${AI_SERVICE_URL:-http://localhost:8000}"
OUT="qa/responses/ai"
mkdir -p "$OUT"

req() {
  local name="$1"; shift
  local status=$(curl -s -o "$OUT/${name}.txt" -w "%{http_code}" --max-time 30 "$@")
  echo "$name -> $status"
}

req health "$AI_URL/health"
req empty_body -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" -d '{}'
req malformed_json -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" -d '{bad json'
req wrong_content_type -X POST "$AI_URL/api/plan-trip" -H "Content-Type: text/plain" -d 'not json at all'
req unicode_hindi_origin -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"x","origin":"दिल्ली","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req confirm_missing_tripDraftId -X POST "$AI_URL/api/plan-trip/confirm" -H "Content-Type: application/json" -d '{"decision":"accept"}'
req confirm_invalid_tripDraftId -X POST "$AI_URL/api/plan-trip/confirm" -H "Content-Type: application/json" -d '{"tripDraftId":"nonexistent-fake-id","decision":"accept"}'
req confirm_invalid_decision -X POST "$AI_URL/api/plan-trip/confirm" -H "Content-Type: application/json" -d '{"tripDraftId":"x","decision":"maybe"}'

echo ""
echo "NOTE: dependency-failure test (kill backend, hit ai-service) is destructive"
echo "to the running dev environment and is NOT included here as an automatic"
echo "step -- see qa/reports/brutal-qa-report.md for that test's methodology"
echo "and result (P0 finding: ai-service hangs indefinitely and does not"
echo "self-recover once its backend dependency drops mid-request)."
