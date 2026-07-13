# Deployment

Production-развёртывание LonghuaCRM: один контейнер приложения + PostgreSQL.

## Вариант A: Docker Compose (рекомендуется)

### 1. Подготовка сервера

- Linux VM с Docker и Docker Compose
- Домен с DNS на сервер
- SSL через reverse proxy (nginx / Caddy / Traefik)

### 2. Конфигурация

```bash
cp .env.example .env
```

Обязательно задать:

```env
NODE_ENV=production
JWT_SECRET=<long-random-secret>
ADMIN_PASSWORD=<strong-password>
APP_PUBLIC_URL=https://crm.example.com
CORS_ORIGINS=https://crm.example.com
DATABASE_URL=postgresql://...   # или через compose vars
TRUST_PROXY=true
MAIL_HOST=...
TELEGRAM_WEBHOOK_URL=https://crm.example.com/api/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=<secret>
```

### 3. Сборка и запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Контейнер `longhua-app` слушает порт 3001. Nginx проксирует 443 → 3001.

### 4. Миграции

При первом деплое миграции применяются если `migrationsRun` включён, иначе:

```bash
docker exec longhua-app npm run migration:run --prefix apps/api
```

Или выполнить миграции до старта app в CI pipeline.

### 5. Health checks

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`

Настроить в load balancer / k8s probes.

## Вариант B: Bare metal / PM2

```bash
npm ci
cd apps/api && npm ci && cd ../..
npm run build
npm run migration:run
NODE_ENV=production node apps/api/dist/main.js
```

Frontend собирается в `dist/`, API раздаёт его при `SERVE_FRONTEND=true`.

PM2 example:

```bash
pm2 start apps/api/dist/main.js --name longhua-api
pm2 save
```

## Reverse proxy (nginx)

```nginx
server {
  listen 443 ssl;
  server_name crm.example.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Установить `TRUST_PROXY=true` в `.env`.

## PostgreSQL

- Dev: `docker-compose.yml`
- Production: managed PostgreSQL (RDS, Supabase, etc.) или контейнер из `docker-compose.prod.yml`
- Регулярный backup: cron + `scripts/backup-db.sh`

```cron
0 3 * * * cd /opt/longhua && ./scripts/backup-db.sh --docker
```

## Восстановление БД

```bash
./scripts/restore-db.sh --docker backups/longhua-YYYYMMDD.dump
```

**Внимание:** `--clean` удаляет существующие объекты. Делать только на staging или после полного backup.

## Файлы uploads

Volume `uploads_data` в docker-compose.prod. При bare metal — persistent directory `uploads/`.

## Rollback деплоя

1. Остановить app: `docker compose -f docker-compose.prod.yml down`
2. Checkout предыдущего git tag/commit
3. Rebuild и up
4. При необходимости: `migration:revert` (если новая миграция несовместима) или restore DB

## SSL

Терминация SSL на reverse proxy. API работает по HTTP внутри private network.

## Мониторинг

- Health endpoints для uptime
- Логи: `docker logs longhua-app -f`
- PostgreSQL metrics (connections, slow queries)

## Выпуск новой версии

См. [Release-Checklist.md](./Release-Checklist.md).
