#!/bin/bash
set -uo pipefail
AI_URL="${AI_SERVICE_URL:-http://localhost:8000}"
OUT="qa/responses/trip"
mkdir -p "$OUT"

req() {
  local name="$1"; shift
  local status=$(curl -s -o "$OUT/${name}.txt" -w "%{http_code}" "$@")
  echo "$name -> $status"
}

req "valid_high_pressure_dest" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-12-25","endDate":"2026-12-27","travellers":2,"budgetINR":30000,"interests":{"trek":0.8}}'

req "travellers_zero" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":0,"budgetINR":30000,"interests":{}}'
req "travellers_negative" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":-1,"budgetINR":30000,"interests":{}}'
req "travellers_huge" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":999999,"budgetINR":30000,"interests":{}}'
req "budget_zero" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":0,"interests":{}}'
req "budget_negative" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":-100,"interests":{}}'
req "missing_origin" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "missing_destId" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "invalid_destination" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"totally-fake-place-xyz","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "same_origin_destination" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"manali","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "end_before_start" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-18","endDate":"2026-09-15","travellers":2,"budgetINR":30000,"interests":{}}'
req "invalid_date" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"notadate","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "empty_interests_object" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{}}'
req "malformed_json" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":'
req "extra_fields" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" \
  -d '{"userId":"qa-test","origin":"Delhi","destId":"manali","startDate":"2026-09-15","endDate":"2026-09-18","travellers":2,"budgetINR":30000,"interests":{},"isAdmin":true,"forcedPressure":0}'
req "empty_body" -X POST "$AI_URL/api/plan-trip" -H "Content-Type: application/json" -d '{}'
