import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import type { GlobalSetupContext } from 'vitest/node';

// Podman support: auto-detect socket, disable Ryuk for rootless podman
if (!process.env.DOCKER_HOST) {
  const uid = process.getuid?.();
  if (uid !== undefined) {
    process.env.DOCKER_HOST = `unix:///run/user/${uid}/podman/podman.sock`;
  }
}
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

let container: StartedPostgreSqlContainer;

export async function setup({ provide }: GlobalSetupContext) {
  container = await new PostgreSqlContainer('docker.io/library/postgres:17-alpine')
    .withDatabase('ts_web_crawler_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = container.getConnectionUri();

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  process.env.DATABASE_URL = databaseUrl;
  provide('DATABASE_URL', databaseUrl);
}

export async function teardown() {
  await container?.stop();
}
