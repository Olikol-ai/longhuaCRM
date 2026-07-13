# Production Readiness

Оценка готовности LonghuaCRM к реальной эксплуатации на **июль 2026**. Новый аудит не проводился — статус основан на завершённом system audit и внедрённой production-инфраструктуре.

## Вердикт

**Система готова к пилотной и малой production-эксплуатации** (до ~1 000 активных студентов) при выполнении [Release-Checklist.md](./Release-Checklist.md).

Для высоконагруженного production (10k+) требуются пункты из [Technical-Debt.md](./Technical-Debt.md) (pagination, object storage, worker для cron).

---

## Что уже соответствует production

| Область | Статус |
|---------|--------|
| PostgreSQL + TypeORM migrations | ✅ 8 миграций, synchronize off |
| Entity integrity | ✅ FK, partial uniques, idempotent lesson/payment flows |
| Auth | ✅ JWT, role guards, production JWT_SECRET validation |
| Health probes | ✅ `/api/health/live`, `/api/health/ready` (+ DB) |
| Graceful shutdown | ✅ SIGTERM/SIGINT |
| Security headers | ✅ Helmet (production) |
| Compression | ✅ gzip (production) |
| Rate limiting | ✅ Throttler, webhooks exempt |
| CORS | ✅ Configurable origins in production |
| Docker production stack | ✅ Dockerfile + docker-compose.prod.yml |
| Backup/restore scripts | ✅ `scripts/backup-db.*`, `restore-db.*` |
| Env documentation | ✅ `.env.example`, Environment.md |
| E2E coverage | ✅ 36 API + 8 browser tests |
| Integrity audit script | ✅ 0 orphan findings on clean DB |
| SPA serving | ✅ Single binary deployment option |
| Telegram webhook secret | ✅ Enforced in production |
| File upload limits | ✅ 50 MB, extension allowlist |

---

## Что желательно сделать до широкого запуска

| Item | Effort | Notes |
|------|--------|-------|
| Настроить SMTP на production домене | Low | Коды верификации |
| SSL + reverse proxy | Low | nginx/Caddy |
| Automated DB backup cron | Low | scripts + retention |
| Uptime monitoring | Low | health/ready |
| Staging environment | Medium | Копия prod для тестов миграций |
| Pagination в UI списках | Medium | При >500 записей |
| S3 для uploads | Medium | При >10 GB файлов |

---

## Оставшиеся риски

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overlapping lesson bookings | Medium | Exclusion constraint (debt backlog) |
| lessonBalance via PATCH student | Low | Dedicated endpoint (debt) |
| Single-instance cron | Low | Один app container или leader lock |
| No optimistic locking (general PATCH) | Low | Document; version column later |
| JWT cannot revoke before expiry | Low | Short TTL or refresh tokens later |
| Local disk uploads | Medium | Backup volume; migrate to S3 |

---

## Ограничения

- Один NestJS процесс = API + static + cron (не разделено)
- Нет встроенного APM/tracing
- Нет multi-tenant isolation (одна школа на инстанс)
- Alfa Bank — опциональная интеграция, требует отдельной настройки

---

## Масштабирование

### До 1 000 студентов

**Текущая архитектура достаточна.**

- 1× VM: 2 vCPU, 4 GB RAM
- PostgreSQL на том же хосте или managed small instance
- Ежедневный backup
- Один app container

### До 10 000 студентов

| Component | Change |
|-----------|--------|
| API | 2–3 stateless replicas behind LB |
| PostgreSQL | Managed, 4+ vCPU, connection pooling |
| Cron | Выделить worker process (`ENABLE_CRON` только на worker) |
| Files | S3-compatible storage |
| Frontend | CDN для `dist/` static assets |
| Lists | Обязательная pagination + индексы |

Оценка RAM: API 512 MB × N replicas + PostgreSQL 8 GB.

### До 100 000 студентов

| Component | Change |
|-----------|--------|
| Database | Read replicas, партиционирование `lessons`/`attendance` по date |
| Queue | BullMQ/Redis для notifications, reminders, webhooks |
| Search | PostgreSQL full-text или Elasticsearch для directory |
| Cache | Redis для settings, public config |
| Observability | APM, metrics, distributed tracing |

Горизонтальное шардирование БД **не требуется** на этом этапе для single-school CRM.

---

## Go-live минимум

1. `.env` production secrets
2. `docker compose -f docker-compose.prod.yml up -d --build`
3. `migration:run`
4. Smoke: health → login → create student → lesson
5. Backup cron
6. Monitoring on `/api/health/ready`

См. также [Deployment.md](./Deployment.md) и [Release-Checklist.md](./Release-Checklist.md).
