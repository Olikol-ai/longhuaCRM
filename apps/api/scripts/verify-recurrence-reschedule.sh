#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001/api"
EMAIL="admin@longhua.local"
PASS="TestAdmin123!"

TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')

TEACHER_ID=$(curl -s -X POST "$API/teachers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"RecVerify $(date +%s)\",\"email\":\"recverify-$(date +%s)@test.local\",\"password\":\"TestTeacher123!\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')

STUDENT_ID=$(curl -s -X POST "$API/students" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"RecVerify Student\",\"assignedTeacherId\":\"$TEACHER_ID\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).id')

for DOW in 1 2; do
  curl -s -X POST "$API/schedule" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"teacherId\":\"$TEACHER_ID\",\"dayOfWeek\":$DOW,\"timeFrom\":\"09:00\",\"timeTo\":\"21:00\"}" >/dev/null
done

SERIES_JSON=$(curl -s -X POST "$API/lessons/recurring" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"teacherId\":\"$TEACHER_ID\",\"primaryStudentId\":\"$STUDENT_ID\",\"date\":\"2026-09-01\",\"startTime\":\"18:30\",\"duration\":60,\"untilDate\":\"2026-09-30\"}")

SERIES_ID=$(echo "$SERIES_JSON" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); if(!j.series) { console.error(j); process.exit(1);} j.series.id')
ANCHOR_ID=$(echo "$SERIES_JSON" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); (j.first_lesson||j.firstLesson).id')

echo "=== BEFORE (following scope test) ==="
curl -s "$API/lessons" -H "Authorization: Bearer $TOKEN" | node -pe "
const s='$SERIES_ID';
JSON.parse(require('fs').readFileSync(0,'utf8'))
  .filter(r => r.recurrence_series_id === s && r.status === 'planned')
  .sort((a,b) => a.date.localeCompare(b.date))
  .forEach(r => console.log(r.date, String(r.start_time).slice(0,5)));
"

PATCH=$(curl -s -w ' HTTP:%{http_code}' -X PATCH "$API/lessons/$ANCHOR_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"date":"2026-09-02","applyScope":"following"}')
echo "PATCH following (first lesson) result:$PATCH"

echo "=== AFTER ==="
curl -s "$API/lessons" -H "Authorization: Bearer $TOKEN" | node -pe "
const s='$SERIES_ID';
JSON.parse(require('fs').readFileSync(0,'utf8'))
  .filter(r => r.recurrence_series_id === s && r.status === 'planned')
  .sort((a,b) => a.date.localeCompare(b.date))
  .forEach(r => console.log(r.date, String(r.start_time).slice(0,5)));
"

echo "=== DB verify ==="
PGPASSWORD=postgres psql -h localhost -U postgres -d longhua -t -c \
  "SELECT date, start_time FROM lessons WHERE recurrence_series_id='$SERIES_ID' AND status='planned' ORDER BY date;"
