#!/bin/bash
# QA: authentication surface (signup/login/logout/check), valid + fuzz.
# Usage: BASE_URL=http://localhost:5001 bash qa/curl/auth.sh
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:5001}"
TS=$(date +%s)
QA_EMAIL="${QA_EMAIL:-qa.traveller.${TS}@example.com}"
QA_PASSWORD="${QA_PASSWORD:-TestPassword123}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/qa_auth_cookies_${TS}.txt}"
OUT="qa/responses/auth"
mkdir -p "$OUT"

req() {
  local name="$1"; shift
  echo "=== $name ==="
  curl -s -i "$@" | tee "$OUT/${name}.txt" | tail -1
  echo ""
}

echo "QA_EMAIL=$QA_EMAIL"

# --- valid ---
req "signup_valid" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"fullName\":\"QA Traveller\",\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASSWORD\"}"

# --- signup fuzzing ---
req "signup_missing_fullName" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"email":"x1@example.com","password":"Test1234"}'
req "signup_missing_email" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","password":"Test1234"}'
req "signup_missing_password" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":"x2@example.com"}'
req "signup_empty_email" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":"","password":"Test1234"}'
req "signup_invalid_email" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":"not-an-email","password":"Test1234"}'
req "signup_short_password" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":"x3@example.com","password":"12"}'
req "signup_long_password" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"fullName\":\"X\",\"email\":\"x4@example.com\",\"password\":\"$(printf 'a%.0s' {1..5000})\"}"
req "signup_null_values" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":null,"email":null,"password":null}'
req "signup_wrong_types" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":123,"email":[],"password":{}}'
req "signup_extra_fields" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"fullName\":\"X\",\"email\":\"x5@example.com\",\"password\":\"Test1234\",\"role\":\"authority\",\"isAdmin\":true}"
req "signup_duplicate_email" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Dup\",\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASSWORD\"}"
req "signup_whitespace_fields" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"   ","email":"   ","password":"   "}'
req "signup_unicode" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"क्षि परीक्षण","email":"unicode-test@example.com","password":"Test1234"}'
req "signup_html_injection" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"<script>alert(1)</script>","email":"xss-test@example.com","password":"Test1234"}'
req "signup_malformed_json" -X POST "$BASE_URL/api/auth/signup" -H "Content-Type: application/json" \
  -d '{"fullName":"X","email":'

# --- login: valid + attack ---
req "login_valid" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASSWORD\"}"
req "login_wrong_password" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"WrongPassword\"}"
req "login_wrong_email" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"nonexistent-$TS@example.com\",\"password\":\"$QA_PASSWORD\"}"
req "login_empty_credentials" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"","password":""}'
req "login_null_credentials" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":null,"password":null}'
req "login_malformed_json" -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"x@example.com",'

# --- auth check ---
req "check_with_valid_cookie" -b "$COOKIE_JAR" "$BASE_URL/api/auth/check"
req "check_without_cookie" "$BASE_URL/api/auth/check"
req "check_invalid_cookie" -H "Cookie: jwt=invalid.token.value" "$BASE_URL/api/auth/check"
req "check_modified_cookie" -H "Cookie: jwt=$(cat "$COOKIE_JAR" | grep jwt | awk '{print $7}')X" "$BASE_URL/api/auth/check"

# --- logout + verify invalidated ---
req "logout" -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE_URL/api/auth/logout"
req "check_after_logout" -b "$COOKIE_JAR" "$BASE_URL/api/auth/check"

echo "Done. QA_EMAIL=$QA_EMAIL COOKIE_JAR=$COOKIE_JAR"
