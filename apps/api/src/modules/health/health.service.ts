import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type HealthStatus = {
  ok: boolean;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database?: 'up' | 'down';
  error?: string;
};

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  live(): HealthStatus {
    return {
      ok: true,
      service: 'longhua-crm-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  async ready(): Promise<HealthStatus> {
    const base = this.live();
    try {
      await this.dataSource.query('SELECT 1');
      return { ...base, database: 'up' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unavailable';
      return {
        ...base,
        ok: false,
        database: 'down',
        error: message,
      };
    }
  }
}
