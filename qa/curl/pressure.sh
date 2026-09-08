#!/bin/bash
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
OUT="qa/responses/pressure"
mkdir -p "$OUT"

req() {
  local name="$1"; shift
  local status=$(curl -s -o "$OUT/${name}.txt" -w "%{http_code}" "$@")
  echo "$name -> $status"
}

req "valid_destId_valid_date" "$BASE_URL/api/v1/pressure/manali?date=2026-09-10"
req "invalid_destId" "$BASE_URL/api/v1/pressure/nonexistent-fake-place-xyz?date=2026-09-10"
req "google_place_id_instead_of_destId" "$BASE_URL/api/v1/pressure/ChIJbU60yXAbrjsR4E9-UejD3_g?date=2026-09-10"
req "displayName_instead_of_destId" "$BASE_URL/api/v1/pressure/Manali%2C%20Himachal%20Pradesh?date=2026-09-10"
req "missing_date" "$BASE_URL/api/v1/pressure/manali"
req "invalid_date_format" "$BASE_URL/api/v1/pressure/manali?date=notadate"
req "past_date" "$BASE_URL/api/v1/pressure/manali?date=2020-01-01"
req "far_future_date" "$BASE_URL/api/v1/pressure/manali?date=2099-01-01"
req "malformed_date" "$BASE_URL/api/v1/pressure/manali?date=2026-13-45"
req "empty_destId" "$BASE_URL/api/v1/pressure/?date=2026-09-10"
req "sql_injection_destId" "$BASE_URL/api/v1/pressure/manali%27%20OR%20%271%27%3D%271?date=2026-09-10"
req "nosql_injection_date" "$BASE_URL/api/v1/pressure/manali?date[%24gt]="

echo ""
echo "=== pressure map ==="
req "map_valid_date" "$BASE_URL/api/v1/pressure/map?date=2026-09-10"
req "map_missing_date" "$BASE_URL/api/v1/pressure/map"
req "map_invalid_date" "$BASE_URL/api/v1/pressure/map?date=garbage"
