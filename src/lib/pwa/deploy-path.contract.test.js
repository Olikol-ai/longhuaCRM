import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Production deploy path', () => {
  it('deploy.sh keeps backup gates and starts via systemd/screen runtime (npm run dev)', () => {
    const sh = read('deploy.sh');
    assert.match(sh, /BACKUP_REQUIRED="\$\{BACKUP_REQUIRED:-1\}"/);
    assert.match(sh, /die "BACKUP_REQUIRED=1 but backup failed/);
    assert.match(sh, /die "BACKUP_REQUIRED=1 but pg_dump is not installed/);
    assert.match(sh, /wait_http "\$HEALTH_LIVE_URL"/);
    assert.match(sh, /wait_http "\$HEALTH_URL"/);
    assert.match(sh, /start_systemd_runtime|longhua-screen-runtime\.sh/);
    assert.match(sh, /npm run dev/);
    assert.match(sh, /SCREEN_NAME/);
  });

  it('docker-compose.prod.yml has no postgres password fallback', () => {
    const yml = read('docker-compose.prod.yml');
    assert.match(yml, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?/);
    assert.match(yml, /DATABASE_URL:.*POSTGRES_PASSWORD:\?/);
    assert.doesNotMatch(yml, /POSTGRES_PASSWORD:-postgres/);
    assert.match(yml, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/);
    assert.match(yml, /APP_PUBLIC_URL:\s*\$\{APP_PUBLIC_URL:\?/);
  });
});
