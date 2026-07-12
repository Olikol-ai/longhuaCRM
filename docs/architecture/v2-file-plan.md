# LongHua CRM v2 — File Plan

## Remove entirely

```
apps/api/src/modules/entities/
apps/api/src/modules/legacy/
apps/api/src/modules/functions/
apps/api/src/modules/settings/
apps/api/src/modules/shop/
apps/api/src/modules/welcome/
apps/api/src/modules/students/          (old service-only)
apps/api/src/modules/payments/        (old service-only)
apps/api/src/modules/files/             → materials
apps/api/src/entities/                (global entity folder)
apps/api/src/common/constants/entity-registry.ts
apps/api/src/common/constants/entity-names.ts
apps/api/src/common/constants/entity-names.json
apps/api/src/common/constants/entity-permissions.ts
apps/api/src/common/utils/record.util.ts
apps/api/src/database/migrations/1730000000000-*.ts … 0020
shared/entity-names.json
src/api/entities.js
```

## New backend layout

```
apps/api/src/
  database/
    entity-registry.ts          # ALL_V2_ENTITIES
    data-source.ts
    migrations/
      1731000000000-InitialSchemaV2.ts
  modules/
    auth/
      entities/pending-registration.entity.ts
      auth.module.ts | auth.controller.ts | auth.service.ts
      pending-registration.repository.ts | jwt.strategy.ts | onboarding.ts
      dto/
    users/
      entities/user.entity.ts
      users.module.ts | users.controller.ts | users.service.ts | users.repository.ts
      dto/
    students/
      entities/student.entity.ts
      students.module.ts | students.controller.ts | students.service.ts | students.repository.ts
      dto/
    teachers/
      entities/teacher.entity.ts
      teachers.module.ts | teachers.controller.ts | teachers.service.ts | teachers.repository.ts
      dto/
    courses/
      entities/course-template.entity.ts | enrollment.entity.ts
      courses.module.ts | courses.controller.ts | courses.service.ts | courses.repository.ts
      dto/
    groups/
      entities/group.entity.ts | group-member.entity.ts
      groups.module.ts | groups.controller.ts | groups.service.ts | groups.repository.ts
      dto/
    lessons/
      entities/lesson.entity.ts | attendance.entity.ts
      lessons.module.ts | lessons.controller.ts | lessons.service.ts | lessons.repository.ts
      dto/
    schedule/
      entities/availability-slot.entity.ts | lesson-series.entity.ts | series-student.entity.ts | series-exclusion.entity.ts | availability-booking.entity.ts
      schedule.module.ts | schedule.controller.ts | schedule.service.ts | schedule.repository.ts
      dto/
    payments/
      entities/payment.entity.ts | shop-item.entity.ts
      payments.module.ts | payments.controller.ts | payments.service.ts | payments.repository.ts
      dto/
    materials/
      entities/material.entity.ts | material-folder.entity.ts | material-access.entity.ts | material-link.entity.ts
      materials.module.ts | materials.controller.ts | materials.service.ts | materials.repository.ts
      dto/
    certificates/
      entities/certificate.entity.ts
      certificates.module.ts | certificates.controller.ts | certificates.service.ts | certificates.repository.ts
      dto/
    notifications/
      entities/notification.entity.ts
      notifications.module.ts | notifications.controller.ts | notifications.service.ts | notifications.repository.ts
      dto/
    audit/
      entities/audit-log.entity.ts
      audit.module.ts | audit.service.ts | audit.repository.ts
    integrations/
      mail/ | telegram/ | alfabank/ | webhooks/ | uploads/
    health/ | spa/ | jobs/
  app.module.ts
```

## New frontend layout

```
src/api/
  http.js
  index.js
  auth.api.js
  users.api.js
  students.api.js
  teachers.api.js
  courses.api.js
  groups.api.js
  lessons.api.js
  schedule.api.js
  payments.api.js
  materials.api.js
  certificates.api.js
  notifications.api.js
  settings.api.js
  integrations.api.js
```

## API routes (v2)

| Domain | Base path |
|--------|-----------|
| Auth | `/auth/*` |
| Users | `/users` |
| Students | `/students` |
| Teachers | `/teachers` |
| Courses | `/courses` |
| Groups | `/groups` |
| Lessons | `/lessons` |
| Schedule | `/schedule` |
| Payments | `/payments` |
| Materials | `/materials` |
| Certificates | `/certificates` |
| Notifications | `/notifications` |
