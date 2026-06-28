import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

const envCandidates = [
  join(__dirname, '../../../../.env'),
  join(__dirname, '../../../.env'),
  join(process.cwd(), '../../.env'),
  join(process.cwd(), '.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function requirePassword(password: string | undefined): string {
  if (typeof password !== 'string' || password.trim() === '') {
    throw new Error('Missing DB_PASSWORD in environment variables');
  }

  return password;
}

function parseDatabaseUrl(url: string): PostgresConnectionConfig {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid DATABASE_URL in environment variables');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql:// scheme');
  }

  const database = parsed.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('DATABASE_URL must include a database name');
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 5432,
    username: decodeURIComponent(parsed.username || 'postgres'),
    password: requirePassword(decodeURIComponent(parsed.password || '')),
    database,
  };
}

export function resolvePostgresConnectionConfig(): PostgresConnectionConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return parseDatabaseUrl(databaseUrl);
  }

  return {
    host: process.env.DB_HOST?.trim() || 'localhost',
    port: Number(process.env.DB_PORT?.trim() || '5432'),
    username:
      process.env.DB_USERNAME?.trim() ||
      process.env.DB_USER?.trim() ||
      'postgres',
    password: requirePassword(process.env.DB_PASSWORD),
    database:
      process.env.DB_DATABASE?.trim() ||
      process.env.DB_NAME?.trim() ||
      'longhua',
  };
}

export function getDatabaseDataSourceOptions(): DataSourceOptions {
  const connection = resolvePostgresConnectionConfig();

  return {
    type: 'postgres',
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: connection.database,
  };
}
