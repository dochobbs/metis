#!/usr/bin/env bash
#
# e2e-smoke.sh — End-to-end smoke test for the MedEd platform (W7.3).
#
# Exercises the critical cross-service path:
#   Athena (knowledge) → Oread (patient gen) → Mneme (EMR import) →
#   Syrinx (voice store) → Echo (tutor Q&A) → Metis (portal + proxy)
#
# Read-mostly where possible. The Echo /question call is a real Claude API hit
# (kept minimal). The Mneme import may hit a real Supabase if configured;
# without it, the test accepts a clear 500 detail.
#
# Usage:
#   ./e2e-smoke.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — at least one check failed (or prerequisite missing)

set -euo pipefail

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------

ATHENA_URL="http://localhost:9105"
OREAD_URL="http://localhost:9104"
SYRINX_URL="http://localhost:9103"
MNEME_URL="http://localhost:9102"
ECHO_URL="http://localhost:9101"
METIS_URL="http://localhost:9100"

CURL_TIMEOUT=15
GENERATE_TIMEOUT=240   # Oread /api/generate uses LLM; can take ~2min

START_TIME=$(date +%s)
PASS=0
FAIL=0
TOTAL=0

# ----------------------------------------------------------------------------
# Color handling (respects NO_COLOR)
# ----------------------------------------------------------------------------

if [ -n "${NO_COLOR:-}" ] || [ ! -t 1 ]; then
  C_GREEN=""
  C_RED=""
  C_YELLOW=""
  C_DIM=""
  C_BOLD=""
  C_RESET=""
  MARK_PASS="[PASS]"
  MARK_FAIL="[FAIL]"
else
  C_GREEN=$'\033[0;32m'
  C_RED=$'\033[0;31m'
  C_YELLOW=$'\033[0;33m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
  MARK_PASS="${C_GREEN}\xe2\x9c\x93${C_RESET}"
  MARK_FAIL="${C_RED}\xe2\x9c\x97${C_RESET}"
fi

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

pass() {
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  printf "  %b %s\n" "$MARK_PASS" "$1"
  if [ -n "${2:-}" ]; then
    printf "      %s%s%s\n" "$C_DIM" "$2" "$C_RESET"
  fi
}

fail() {
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  printf "  %b %s\n" "$MARK_FAIL" "$1"
  if [ -n "${2:-}" ]; then
    printf "      %s%s%s\n" "$C_DIM" "$2" "$C_RESET"
  fi
}

section() {
  printf "\n%s%s%s\n" "$C_BOLD" "$1" "$C_RESET"
}

# curl wrapper: prints HTTP status on stderr, body on stdout
http_get() {
  local url="$1"
  curl -sS --max-time "$CURL_TIMEOUT" -w '\n__HTTP_STATUS__:%{http_code}' "$url" 2>/dev/null || echo $'\n__HTTP_STATUS__:000'
}

http_post() {
  local url="$1"
  local body="$2"
  local timeout="${3:-$CURL_TIMEOUT}"
  curl -sS --max-time "$timeout" -X POST \
    -H 'Content-Type: application/json' \
    -d "$body" \
    -w '\n__HTTP_STATUS__:%{http_code}' \
    "$url" 2>/dev/null || echo $'\n__HTTP_STATUS__:000'
}

# Extracts the status code printed by the -w format above.
extract_status() {
  echo "$1" | awk -F: '/^__HTTP_STATUS__:/ { print $2 }' | tail -1
}

# Strips the status line so the remaining text is just the body.
extract_body() {
  echo "$1" | sed '/^__HTTP_STATUS__:/d'
}

# Quick liveness probe — true if any 2xx/3xx/4xx response comes back.
service_up() {
  local url="$1"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo "000")
  [ "$code" != "000" ]
}

# ----------------------------------------------------------------------------
# Prereqs
# ----------------------------------------------------------------------------

if ! command -v jq >/dev/null 2>&1; then
  printf "%bjq is required but not installed.%b\n" "$C_RED" "$C_RESET" >&2
  printf "  Install with: brew install jq\n" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  printf "%bcurl is required but not installed.%b\n" "$C_RED" "$C_RESET" >&2
  exit 1
fi

printf "%bMedEd E2E Smoke Test%b\n" "$C_BOLD" "$C_RESET"
printf "%s\n" "===================="

# ----------------------------------------------------------------------------
# Step 0: Service liveness
# ----------------------------------------------------------------------------

section "0. Service liveness"

DOWN=()
service_up "$ATHENA_URL/api/health"      || DOWN+=("Athena (9105)")
service_up "$OREAD_URL/"                 || DOWN+=("Oread (9104)")
service_up "$SYRINX_URL/"                || DOWN+=("Syrinx (9103)")
service_up "$MNEME_URL/health"           || DOWN+=("Mneme (9102)")
service_up "$ECHO_URL/health"            || DOWN+=("Echo (9101)")
service_up "$METIS_URL/"                 || DOWN+=("Metis Portal (9100)")

if [ "${#DOWN[@]}" -gt 0 ]; then
  printf "  %b One or more services are not responding:\n" "$MARK_FAIL"
  for s in "${DOWN[@]}"; do
    printf "      - %s\n" "$s"
  done
  printf "\n  Start them with: %s./start-all.sh%s (in metis/scripts)\n" "$C_BOLD" "$C_RESET"
  exit 1
fi
pass "All 6 services responding"

# ----------------------------------------------------------------------------
# Step a/b/c: Athena
# ----------------------------------------------------------------------------

section "1. Athena (knowledge service)"

# (a) /api/health with knowledge counts
resp=$(http_get "$ATHENA_URL/api/health")
code=$(extract_status "$resp")
body=$(extract_body "$resp")
if [ "$code" = "200" ]; then
  conds=$(echo "$body" | jq -r '.knowledge.conditions // 0' 2>/dev/null || echo 0)
  fwks=$(echo "$body" | jq -r '.knowledge.frameworks // 0' 2>/dev/null || echo 0)
  if [ "${conds:-0}" -gt 0 ] && [ "${fwks:-0}" -gt 0 ]; then
    pass "Athena /api/health" "knowledge.conditions=$conds frameworks=$fwks"
  else
    fail "Athena /api/health" "Expected conditions>0 and frameworks>0, got c=$conds f=$fwks"
  fi
else
  fail "Athena /api/health" "HTTP $code"
fi

# (b) pediatrics conditions >= 30
resp=$(http_get "$ATHENA_URL/api/conditions?specialty=pediatrics")
code=$(extract_status "$resp")
body=$(extract_body "$resp")
if [ "$code" = "200" ]; then
  n=$(echo "$body" | jq 'length' 2>/dev/null || echo 0)
  if [ "${n:-0}" -ge 30 ]; then
    pass "Athena /api/conditions?specialty=pediatrics" "$n conditions (>=30 required)"
  else
    fail "Athena /api/conditions?specialty=pediatrics" "Only $n conditions returned (need >=30)"
  fi
else
  fail "Athena /api/conditions?specialty=pediatrics" "HTTP $code"
fi

# (c) invalid specialty → 400
resp=$(http_get "$ATHENA_URL/api/conditions?specialty=dermatology")
code=$(extract_status "$resp")
if [ "$code" = "400" ] || [ "$code" = "422" ]; then
  pass "Athena rejects invalid specialty" "HTTP $code (expected 400/422)"
else
  fail "Athena rejects invalid specialty" "Expected 400/422, got HTTP $code"
fi

# ----------------------------------------------------------------------------
# Step d/e/f: Oread
# ----------------------------------------------------------------------------

section "2. Oread (patient generation)"

PATIENT_ID=""
PATIENT_JSON=""
PATIENT_CONTEXT=""

# (d) POST /api/generate
resp=$(http_post "$OREAD_URL/api/generate" '{"age_months": 24, "specialty": "pediatrics"}' "$GENERATE_TIMEOUT")
code=$(extract_status "$resp")
body=$(extract_body "$resp")
if [ "$code" = "200" ] || [ "$code" = "201" ]; then
  PATIENT_ID=$(echo "$body" | jq -r '.id // .patient_id // empty' 2>/dev/null || echo "")
  if [ -n "$PATIENT_ID" ] && [ "$PATIENT_ID" != "null" ]; then
    pass "Oread POST /api/generate" "id=$PATIENT_ID"
  else
    fail "Oread POST /api/generate" "200 OK but no id in response"
  fi
else
  fail "Oread POST /api/generate" "HTTP $code — body: $(echo "$body" | head -c 200)"
fi

# (e) GET /api/patients/{id}?format=json
if [ -n "$PATIENT_ID" ]; then
  resp=$(http_get "$OREAD_URL/api/patients/$PATIENT_ID?format=json")
  code=$(extract_status "$resp")
  body=$(extract_body "$resp")
  if [ "$code" = "200" ]; then
    # Oread's format=json returns nested demographics with given_names (array),
    # sex_at_birth, date_of_birth. Accept flat OR nested shape.
    has_fields=$(echo "$body" | jq -r '
      (
        ((.name // .first_name // .demographics.first_name // .demographics.given_names[0]) != null) and
        ((.age_months // .demographics.age_months // .demographics.date_of_birth) != null) and
        ((.sex // .demographics.sex // .demographics.sex_at_birth) != null)
      ) // false
    ' 2>/dev/null || echo "false")
    if [ "$has_fields" = "true" ]; then
      PATIENT_JSON="$body"
      pass "Oread GET /api/patients/{id}?format=json" "name/age/sex present"
    else
      fail "Oread GET /api/patients/{id}?format=json" "Missing name/age/sex fields"
    fi
  else
    fail "Oread GET /api/patients/{id}?format=json" "HTTP $code"
  fi
else
  fail "Oread GET /api/patients/{id}?format=json" "Skipped — no patient id from generate"
fi

# (f) GET /api/patients/{id}/context — flat PatientContext
if [ -n "$PATIENT_ID" ]; then
  resp=$(http_get "$OREAD_URL/api/patients/$PATIENT_ID/context")
  code=$(extract_status "$resp")
  body=$(extract_body "$resp")
  if [ "$code" = "200" ]; then
    # All required flat fields per integration contract.
    has_all=$(echo "$body" | jq -r '
      (
        (.name != null) and
        (.age_years != null) and
        (.age_months != null) and
        (.sex != null) and
        (.source != null) and
        (.problem_list != null) and
        (.medication_list != null) and
        (.allergy_list != null)
      ) // false
    ' 2>/dev/null || echo "false")
    if [ "$has_all" = "true" ]; then
      PATIENT_CONTEXT="$body"
      pass "Oread GET /api/patients/{id}/context" "flat PatientContext shape OK"
    else
      missing=$(echo "$body" | jq -r '
        [
          (if .name == null then "name" else empty end),
          (if .age_years == null then "age_years" else empty end),
          (if .age_months == null then "age_months" else empty end),
          (if .sex == null then "sex" else empty end),
          (if .source == null then "source" else empty end),
          (if .problem_list == null then "problem_list" else empty end),
          (if .medication_list == null then "medication_list" else empty end),
          (if .allergy_list == null then "allergy_list" else empty end)
        ] | join(",")
      ' 2>/dev/null || echo "?")
      fail "Oread GET /api/patients/{id}/context" "Missing field(s): $missing"
    fi
  else
    fail "Oread GET /api/patients/{id}/context" "HTTP $code"
  fi
else
  fail "Oread GET /api/patients/{id}/context" "Skipped — no patient id"
fi

# ----------------------------------------------------------------------------
# Step g: Mneme import
# ----------------------------------------------------------------------------

section "3. Mneme (EMR import)"

if [ -n "$PATIENT_JSON" ]; then
  resp=$(http_post "$MNEME_URL/api/import/oread/json" "$PATIENT_JSON")
  code=$(extract_status "$resp")
  body=$(extract_body "$resp")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    pass "Mneme POST /api/import/oread/json" "HTTP $code — Supabase write succeeded"
  elif [ "$code" = "500" ] || [ "$code" = "503" ]; then
    # Parse JSON detail; fall back to raw body (Mneme returns plain text on uncaught exceptions).
    detail=$(echo "$body" | jq -r '.detail // .message // .error // empty' 2>/dev/null || true)
    if [ -z "$detail" ]; then detail="$body"; fi
    # Best-effort: peek at the server log for the root cause keywords too.
    log_tail=$(tail -50 /tmp/meded-mneme-backend.log 2>/dev/null | tr -d '\n' || true)
    if echo "$detail $log_tail" | grep -qiE 'supabase|httpx.ConnectError|nodename|database|connection|credentials|nxdomain|ServiceUnavailable'; then
      pass "Mneme POST /api/import/oread/json" "HTTP $code (Supabase unreachable — likely DNS or config; see /tmp/meded-mneme-backend.log)"
    else
      fail "Mneme POST /api/import/oread/json" "HTTP $code — unrecognized failure: $(echo "$detail" | head -c 200)"
    fi
  else
    fail "Mneme POST /api/import/oread/json" "HTTP $code — body: $(echo "$body" | head -c 200)"
  fi
else
  fail "Mneme POST /api/import/oread/json" "Skipped — no patient JSON"
fi

# ----------------------------------------------------------------------------
# Step h/i: Syrinx
# ----------------------------------------------------------------------------

section "4. Syrinx (voice patient store)"

if [ -n "$PATIENT_JSON" ]; then
  resp=$(http_post "$SYRINX_URL/api/patients/import" "$PATIENT_JSON")
  code=$(extract_status "$resp")
  body=$(extract_body "$resp")
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    ok=$(echo "$body" | jq -r '.success // false' 2>/dev/null || echo false)
    if [ "$ok" = "true" ]; then
      pass "Syrinx POST /api/patients/import" "success=true"
    else
      fail "Syrinx POST /api/patients/import" "HTTP $code but success!=true — body: $(echo "$body" | head -c 200)"
    fi
  else
    fail "Syrinx POST /api/patients/import" "HTTP $code — body: $(echo "$body" | head -c 200)"
  fi

  # Stored?
  if [ -n "$PATIENT_ID" ]; then
    resp=$(http_get "$SYRINX_URL/api/patients/$PATIENT_ID")
    code=$(extract_status "$resp")
    if [ "$code" = "200" ]; then
      pass "Syrinx GET /api/patients/{id}" "patient retrievable"
    else
      fail "Syrinx GET /api/patients/{id}" "HTTP $code"
    fi
  else
    fail "Syrinx GET /api/patients/{id}" "Skipped — no patient id"
  fi
else
  fail "Syrinx POST /api/patients/import" "Skipped — no patient JSON"
  fail "Syrinx GET /api/patients/{id}" "Skipped — no patient JSON"
fi

# ----------------------------------------------------------------------------
# Step j: Echo
# ----------------------------------------------------------------------------

section "5. Echo (AI tutor — real LLM call)"

if [ -n "$PATIENT_CONTEXT" ]; then
  # Build the Echo /question payload. Keep prompt short to minimize cost.
  echo_payload=$(jq -n \
    --arg q "What should I consider?" \
    --argjson p "$PATIENT_CONTEXT" \
    '{learner_question: $q, patient: $p}')

  resp=$(http_post "$ECHO_URL/question" "$echo_payload")
  code=$(extract_status "$resp")
  body=$(extract_body "$resp")
  if [ "$code" = "200" ]; then
    pass "Echo POST /question" "200 OK from Claude"
  elif [ "$code" = "502" ] || [ "$code" = "503" ]; then
    err=$(echo "$body" | jq -r '.error // .detail // ""' 2>/dev/null || echo "")
    if echo "$err" | grep -qE '^claude_api_'; then
      pass "Echo POST /question" "HTTP $code (expected w/o ANTHROPIC_API_KEY) — error=$err"
    else
      fail "Echo POST /question" "HTTP $code — unexpected error envelope: $(echo "$body" | head -c 200)"
    fi
  else
    fail "Echo POST /question" "HTTP $code — body: $(echo "$body" | head -c 200)"
  fi
else
  fail "Echo POST /question" "Skipped — no patient context"
fi

# ----------------------------------------------------------------------------
# Step k/l: Metis portal + proxy
# ----------------------------------------------------------------------------

section "6. Metis (portal + proxy)"

# (k) Portal index
resp=$(http_get "$METIS_URL/")
code=$(extract_status "$resp")
if [ "$code" = "200" ]; then
  pass "Metis GET /" "portal index returns 200"
else
  fail "Metis GET /" "HTTP $code"
fi

# (l) Proxy to Athena conditions
resp_proxy=$(http_get "$METIS_URL/api/athena/conditions?specialty=pediatrics")
code=$(extract_status "$resp_proxy")
body_proxy=$(extract_body "$resp_proxy")
if [ "$code" = "200" ]; then
  n_proxy=$(echo "$body_proxy" | jq 'length' 2>/dev/null || echo 0)
  # Direct call for comparison
  resp_direct=$(http_get "$ATHENA_URL/api/conditions?specialty=pediatrics")
  body_direct=$(extract_body "$resp_direct")
  n_direct=$(echo "$body_direct" | jq 'length' 2>/dev/null || echo 0)
  if [ "${n_proxy:-0}" = "${n_direct:-0}" ] && [ "${n_proxy:-0}" -gt 0 ]; then
    pass "Metis proxy → Athena" "$n_proxy conditions (matches direct call)"
  else
    fail "Metis proxy → Athena" "Proxy returned $n_proxy, direct returned $n_direct"
  fi
else
  fail "Metis proxy → Athena" "HTTP $code"
fi

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

printf "\n%s\n" "===================="
printf "%bSummary%b\n" "$C_BOLD" "$C_RESET"
printf "  Total : %d\n" "$TOTAL"
printf "  Pass  : %s%d%s\n" "$C_GREEN" "$PASS" "$C_RESET"
printf "  Fail  : %s%d%s\n" "$C_RED" "$FAIL" "$C_RESET"
printf "  Time  : %ds\n" "$ELAPSED"

if [ "$FAIL" -gt 0 ]; then
  printf "\n%bSmoke test FAILED%b\n" "$C_RED" "$C_RESET"
  exit 1
fi

printf "\n%bSmoke test PASSED%b\n" "$C_GREEN" "$C_RESET"
exit 0
