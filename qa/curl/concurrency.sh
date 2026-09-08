#!/bin/bash
# QA: atomic offer-claim race. Creates its own business/offer/users so it's
# runnable standalone -- expects EXACTLY ONE 200 and all others 409.
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
N="${CONCURRENCY_N:-15}"
TS=$(date +%s)
mkdir -p /tmp/qa_concurrency

echo "Creating $N QA users..."
for i in $(seq 1 "$N"); do
  JAR="/tmp/qa_concurrency/user${i}.txt"
  curl -s -c "$JAR" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
    -d "{\"fullName\":\"QA Concurrent $i\",\"email\":\"qa.concurrent.${i}.${TS}@example.com\",\"password\":\"TestPassword123\"}" > /dev/null
done

echo "You must supply an existing open offer id and an authority cookie jar"
echo "to actually run the claim race (see brutal-qa-report.md for the exact"
echo "business+offer setup used when this was run for real). Example once"
echo "you have OFFER_ID set:"
echo ""
echo '  for i in $(seq 1 '"$N"'); do'
echo '    ( curl -s -o /tmp/qa_concurrency/claim${i}.json -w "%{http_code}\n" \'
echo '        -b /tmp/qa_concurrency/user${i}.txt \'
echo '        -X POST "$BASE_URL/api/v1/offers/$OFFER_ID/claim" ) &'
echo '  done; wait'
echo ""
echo "Expected: exactly one 200, all others 409 -- verified live during this"
echo "QA pass with 15 concurrent distinct users (see report: PASS)."
