# Deployment

Canonical path on this host (`/opt/longhuaCRM`): **bare metal + `./deploy.sh`** for updates, **`systemd` + `screen` + `npm run dev`** for runtime/autostart.

`docker-compose.prod.yml` is the packaged alternative for a greenfield Docker VM. Do not run both against the same PostgreSQL data. Do **not** put PostgreSQL into Docker on this host.

## Runtime vs deploy

| Concern | Command | Runs on reboot? |
|---------|---------|-----------------|
| **Deploy** (pull, backup, migrate, build, restart) | `./deploy.sh` | No |
| **Runtime / autostart** | `systemd` `longhua.service` → `screen -S longhua` → `npm run dev` | Yes |

### What `npm run dev` starts

Canonical launcher in `package.json`:

```bash
concurrently "npm run dev:server" "npm run dev:client" "npm run tunnel"
```

- **backend** — Nest (`start:dev`) after migrations  
- **frontend** — Vite on `:5173` (proxies `/api` → `:3001`)  
- **tunnel** — `scripts/run-cloudflare-tunnel.sh` → existing `cloudflared tunnel run --token …`

Do not start a second backend, Vite, or tunnel outside this launcher.

`NODE_ENV` comes from `.env` (not forced to `production`). Secrets are not rewritten by autostart.

### Install / refresh autostart

```bash
cd /opt/longhuaCRM
sudo ./scripts/install-longhua-systemd.sh
```

Useful commands:

```bash
systemctl status longhua
journalctl -u longhua -f
screen -ls
screen -r longhua
curl -fsS http://127.0.0.1:3001/api/health/live
curl -fsS http://127.0.0.1:3001/api/health/ready
```

### Power-loss recovery (BIOS + Ubuntu)

Linux **cannot** power on a machine that is fully off. For “lights restored → PC boots → Longhua up”:

1. In **BIOS/UEFI**, set **Restore AC Power Loss = Power On** (names vary: *AC Power Recovery*, *After Power Loss*, *Restore on AC/Power Loss*).
2. Ubuntu boots.
3. `systemd` starts `longhua.service`.
4. Screen `longhua` runs `npm run dev`.

Without the BIOS setting, Ubuntu (and Longhua) stay off until someone presses the power button.

## Canonical: `./deploy.sh`

Order:

1. Preflight (directory, branch, dirty tree)
2. `systemctl stop longhua` (if installed) + stop screen / Longhua processes
3. `git pull`
4. `npm install`
5. **Backup** (`scripts/backup-db.sh`, `BACKUP_REQUIRED=1` by default)
6. **Migration**
7. **Build** API + client
8. `systemctl start longhua` → `npm run dev` in screen `longhua`
9. Health **live** then **ready**

```bash
cd /opt/longhuaCRM
./deploy.sh
```

Dry-run:

```bash
./deploy.sh --dry-run
```

Environment:

| Variable | Default | Meaning |
|----------|---------|---------|
| `BACKUP_REQUIRED` | `1` | Abort if backup cannot run |
| `SKIP_PRE_MIGRATION_BACKUP` | unset | Emergency only; incompatible with `BACKUP_REQUIRED=1` |
| `HEALTH_LIVE_URL` | `http://127.0.0.1:3001/api/health/live` | Liveness |
| `HEALTH_URL` | `http://127.0.0.1:3001/api/health/ready` | Readiness (DB) |

## Restore

Custom-format dump from `scripts/backup-db.sh`:

```bash
./scripts/restore-db.sh backups/pre-deploy/longhua-YYYYMMDD-HHMMSS.dump
```

Gzipped SQL dump from `scripts/postgres-backup.sh` (Docker postgres): restore into a **temporary** database first:

```bash
./scripts/postgres-restore-test.sh /mnt/storage/backups/postgres/longhua_backup_....sql.gz
```

`--clean` overwrite of production: only after a fresh backup. See `scripts/restore-db.sh`.

## Daily backup

```cron
0 3 * * * /opt/longhuaCRM/scripts/postgres-backup.sh
```

or, if postgres is not in Docker:

```cron
0 3 * * * cd /opt/longhuaCRM && ./scripts/backup-db.sh
```

Retention: `postgres-backup.sh` keeps 30 verified dumps.

## Alternative: Docker Compose (new VM only)

Required env (no defaults): `JWT_SECRET`, `POSTGRES_PASSWORD`, `APP_PUBLIC_URL`, `ADMIN_EMAIL`.

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

Do not use this compose stack on the current bare-metal host alongside the existing PostgreSQL.
