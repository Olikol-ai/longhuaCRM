#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001/api"
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@longhua.local","password":"TestAdmin123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')

TEACHER_ID=$(curl -s -X POST "$API/teachers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"RecAll $(date +%s)\",\"email\":\"recall-$(date +%s)@test.local\",\"password\":\"TestTeacher123!\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')

STUDENT_ID=$(curl -s -X POST "$API/students" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"RecAll Student\",\"assignedTeacherId\":\"$TEACHER_ID\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')

for DOW in 1 2; do
  curl -s -X POST "$API/schedule" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"teacherId\":\"$TEACHER_ID\",\"dayOfWeek\":$DOW,\"timeFrom\":\"09:00\",\"timeTo\":\"21:00\"}" >/dev/null
done

SERIES_JSON=$(curl -s -X POST "$API/lessons/recurring" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"teacherId\":\"$TEACHER_ID\",\"primaryStudentId\":\"$STUDENT_ID\",\"date\":\"2026-09-01\",\"startTime\":\"18:30\",\"duration\":60,\"untilDate\":\"2026-09-30\"}")

SERIES_ID=$(echo "$SERIES_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).series.id')
ANCHOR_ID=$(echo "$SERIES_JSON" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); (j.first_lesson||j.firstLesson).id')

echo "BEFORE ALL:"
PGPASSWORD=postgres psql -h localhost -U postgres -d longhua -t -c \
  "SELECT date FROM lessons WHERE recurrence_series_id='$SERIES_ID' AND status='planned' ORDER BY date;"

curl -s -X PATCH "$API/lessons/$ANCHOR_ID" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"date":"2026-09-02","applyScope":"all"}' | node -pe 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(j.message||"OK", j.date||"");'

echo "AFTER ALL:"
PGPASSWORD=postgres psql -h localhost -U postgres -d longhua -t -c \
  "SELECT date FROM lessons WHERE recurrence_series_id='$SERIES_ID' AND status='planned' ORDER BY date;"
