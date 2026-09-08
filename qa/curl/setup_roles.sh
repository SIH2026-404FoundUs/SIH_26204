#!/bin/bash
# Creates one traveller, one operator, one authority QA account and saves
# their cookie jars + ids. Role is set via direct DB promotion since there is
# no signup-time role field (confirmed: client-supplied "role" in signup body
# is ignored server-side -- see qa/reports for evidence).
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
TS=$(date +%s)
PASSWORD="TestPassword123"
mkdir -p /tmp/qa_roles

for role in traveller operator authority; do
  EMAIL="qa.${role}.${TS}@example.com"
  JAR="/tmp/qa_roles/${role}.cookies.txt"
  BODY=$(curl -s -c "$JAR" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
    -d "{\"fullName\":\"QA ${role}\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
  ID=$(echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d)._id)}catch(e){console.log('')}})")
  echo "${role}_EMAIL=$EMAIL"
  echo "${role}_ID=$ID"
  echo "${role}_JAR=$JAR"
done
