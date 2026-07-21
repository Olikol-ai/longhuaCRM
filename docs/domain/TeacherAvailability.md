# Teacher Availability

**Status:** current · See also [storage-policy.md](../architecture/storage-policy.md)

## Model

Weekly free intervals for a teacher are **relational rows**, not a JSON array.

| Table | Entity | Purpose |
|-------|--------|---------|
| `teacher_availability_slots` | `AvailabilitySlotEntity` | One interval: day + time range |
| `teacher_availability_bookings` | `AvailabilityBookingEntity` | Booking / hold against a lesson |

### Slot columns

- `teacher_id` (FK → `teachers`)
- `day_of_week` — Monday = 0 … Sunday = 6
- `time_from` / `time_to` — PostgreSQL `time`
- `created_at` / `updated_at`

There is **no** `slots jsonb` column and **no** parent `teacher_availability` document row for intervals.

## API

Module: `apps/api/src/modules/schedule`

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/schedule/teachers/:teacherId/availability` | List slots (`has_schedule`, `slots[]`) |
| `POST` | `/api/schedule/teachers/:teacherId/availability/replace` | Atomic replace (admin / own teacher) |
| `PUT` | `/api/schedule/teachers/:teacherId/availability` | Deprecated alias of replace |
| `POST` | `/api/schedule` | Create single slot |
| `PATCH` / `DELETE` | `/api/schedule/:id` | Update / delete one slot |

ACL: `ScheduleAccessService` — admin any teacher; teacher only own `teacher_id`.

## Frontend

- Teacher cabinet: `TeacherAvailabilityTab` → `api.schedule.replaceTeacherAvailability`
- Admin view: `TeacherAvailabilityView` (read)

## History

Earlier drafts stored intervals as `slots jsonb` on a single availability row. That design was removed; do not reintroduce JSON storage for availability.
