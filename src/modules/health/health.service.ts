import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { NatsClientService } from '../../infra/nats/nats.client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CONSUMERS } from '../../core/messaging';
import { FastAPIHealthIndicator } from './indicators/fast-api.health';
import { MinIOHealthIndicator } from './indicators/minio.health';
import { NatsHealthIndicator } from './indicators/nats.health';
import { ElsaHealthIndicator } from './indicators/elsa.health';
import { PgVectorHealthIndicator } from './indicators/pgvector.health';
import { RedisService } from '../../infra/redis/redis.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  latency_ms?: number;
  error?: string;
  [key: string]: unknown;
}

interface CachedHealthResult {
  result: Record<string, HealthStatus>;
  timestamp: string;
  pingTimestamp?: string;
}

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private cache: CachedHealthResult | null = null;
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly natsClient: NatsClientService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly fastAPIHealthIndicator: FastAPIHealthIndicator,
    private readonly minIOHealthIndicator: MinIOHealthIndicator,
    private readonly natsHealthIndicator: NatsHealthIndicator,
    private readonly elsaHealthIndicator: ElsaHealthIndicator,
    private readonly pgVectorHealthIndicator: PgVectorHealthIndicator,
    private readonly redisService: RedisService,
    private readonly workerHeartbeats: WorkerHeartbeatService,
  ) {}

  live() { return { status: 'ok' as const, timestamp: new Date().toISOString() }; }

  async ready() {
    const [postgres, nats, redis, minio] = await Promise.all([
      this.checkPostgres(), this.natsHealthIndicator.check(), this.redisService.health().catch(error => ({ status: 'down', error: error.message })), this.minIOHealthIndicator.check(),
    ]);
    const dependencies = { postgres, nats: nats.details.nats, redis, minio: minio.details.minio };
    const down = Object.values(dependencies).some((item: any) => item.status === 'down');
    return { status: down ? 'down' as const : 'ok' as const, dependencies, timestamp: new Date().toISOString() };
  }

  async onModuleInit(): Promise<void> {
    // Subscribe to system.health.ping NATS topic
    await this.subscribeToHealthPing();
    this.logger.log('HealthService initialized');
  }

  async checkHealth(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    services: Record<string, HealthStatus>;
    timestamp: string;
  }> {
    // Check cache first
    if (this.cache && Date.now() - new Date(this.cache.timestamp).getTime() < this.CACHE_TTL_MS) {
      return {
        status: this.calculateAggregateStatus(this.cache.result),
        services: this.cache.result,
        timestamp: this.cache.timestamp,
      };
    }

    // Run all health checks
    const result = await this.runAllHealthChecks();
    
    // Check if status changed and emit WebSocket alert
    await this.checkAndEmitAlerts(result);

    // Update cache
    this.cache = {
      result,
      timestamp: new Date().toISOString(),
      pingTimestamp: this.cache?.pingTimestamp,
    };

    return {
      status: this.calculateAggregateStatus(result),
      services: result,
      timestamp: this.cache.timestamp,
    };
  }

  async checkHealthDetails(): Promise<{
    status: 'ok' | 'degraded' | 'down';
    services: Record<string, HealthStatus>;
    timestamp: string;
    ping_timestamp?: string;
  }> {
    const health = await this.checkHealth();
    return {
      ...health,
      ping_timestamp: this.cache?.pingTimestamp,
    };
  }

  private async runAllHealthChecks(): Promise<Record<string, HealthStatus>> {
    // Run all health checks in parallel
    const [
      postgresResult,
      pgVectorResult,
      natsResult,
      minIOResult,
      fastAPIResult,
      elsaResult,
      redisResult,
      workers,
    ] = await Promise.all([
      this.checkPostgres(),
      this.pgVectorHealthIndicator.check(),
      this.natsHealthIndicator.check(),
      this.minIOHealthIndicator.check(),
      this.fastAPIHealthIndicator.check(),
      this.elsaHealthIndicator.check(),
      this.redisService.health().catch(error => ({ status: 'down', latency_ms: 0, error: error.message })),
      this.workerHeartbeats.listWorkerHealth(),
    ]);

    return {
      postgres: { status: this.mapStatus(postgresResult.status), latency_ms: postgresResult.latency_ms, error: postgresResult.error },
      pgvector: { status: this.mapStatus(pgVectorResult.details.pgvector.status), latency_ms: pgVectorResult.details.pgvector.latency_ms, version: pgVectorResult.details.pgvector.version, error: pgVectorResult.details.pgvector.error },
      nats: { status: this.mapStatus(natsResult.details.nats.status), latency_ms: natsResult.details.nats.latency_ms, jetstream: natsResult.details.nats.jetstream, error: natsResult.details.nats.error },
      minio: { status: this.mapStatus(minIOResult.details.minio.status), latency_ms: minIOResult.details.minio.latency_ms, error: minIOResult.details.minio.error },
      fastapi: { status: this.mapStatus(fastAPIResult.details.fastapi.status), latency_ms: fastAPIResult.details.fastapi.latency_ms, error: fastAPIResult.details.fastapi.error },
      elsa: { status: this.mapStatus(elsaResult.details.elsa.status), latency_ms: elsaResult.details.elsa.latency_ms, error: elsaResult.details.elsa.error },
      redis: { status: this.mapStatus(redisResult.status), latency_ms: redisResult.latency_ms, error: 'error' in redisResult ? redisResult.error : undefined },
      ...Object.fromEntries(this.mapWorkerHealth(workers)),
    };
  }

  private mapWorkerHealth(workers: any[]) {
    const aiEnabled = this.configService.get<boolean>('ai.enabled', false);
    return workers.map((worker: any) => {
      const workerEnabled = this.configService.get<boolean>(`ai.${worker.workerType.replace(/-/g, '')}Enabled`, false);
      if (!aiEnabled || !workerEnabled) {
        return [`worker:${worker.workerType}`, { ...worker, enabled: false, status: 'ok' }];
      }
      return [
        `worker:${worker.workerType}`,
        {
          ...worker,
          enabled: true,
          status: worker.status === 'healthy' ? 'ok' : worker.status === 'degraded' || worker.status === 'stale' ? 'degraded' : 'down',
        },
      ];
    });
  }

  private async checkPostgres(): Promise<{ status: string; latency_ms: number; error?: string }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs > 500 ? 'degraded' : 'up',
        latency_ms: latencyMs,
      };
    } catch (error) {
      return {
        status: 'down',
        latency_ms: Date.now() - start,
        error: (error as Error).message,
      };
    }
  }

  private mapStatus(status: string): 'ok' | 'degraded' | 'down' {
    if (status === 'down') return 'down';
    if (status === 'degraded') return 'degraded';
    return 'ok';
  }

  private calculateAggregateStatus(
    services: Record<string, HealthStatus>,
  ): 'ok' | 'degraded' | 'down' {
    const statuses = Object.values(services).map((s) => s.status);
    
    if (statuses.includes('down')) return 'down';
    if (statuses.includes('degraded')) return 'degraded';
    return 'ok';
  }

  private async checkAndEmitAlerts(result: Record<string, HealthStatus>): Promise<void> {
    if (!this.cache?.result) return;

    for (const [serviceName, status] of Object.entries(result)) {
      const prevStatus = this.cache.result[serviceName]?.status;
      
      // Emit alert if status changed to degraded or down
      if (prevStatus !== status.status && (status.status === 'degraded' || status.status === 'down')) {
        this.realtimeGateway.emitToRoom('admin-health', 'system.health.alert', {
          service: serviceName,
          status: status.status,
          previous_status: prevStatus,
          timestamp: new Date().toISOString(),
          details: status,
        });
        this.logger.warn(`Health alert: ${serviceName} is ${status.status}`);
      }
    }
  }

  private async subscribeToHealthPing(): Promise<void> {
    try {
      await this.natsClient.subscribeDurable({
        subject: 'system.health.ping',
        durableName: `${CONSUMERS.HEALTH_PING}-health-service`,
        handler: async (payload: Record<string, unknown>) => {
          this.logger.debug(`Received health ping: ${JSON.stringify(payload)}`);
          this.cache = {
            ...this.cache,
            result: this.cache?.result || {},
            timestamp: this.cache?.timestamp || new Date().toISOString(),
            pingTimestamp: new Date().toISOString(),
          };
        },
      });
      this.logger.log('Subscribed to system.health.ping');
    } catch (error) {
      this.logger.error(`Failed to subscribe to health ping: ${(error as Error).message}`);
    }
  }

  // Individual component checks for admin endpoints
  async checkAiService(): Promise<{ status: string; latency_ms: number; details?: unknown }> {
    const result = await this.fastAPIHealthIndicator.check();
    return {
      status: result.details.fastapi.status,
      latency_ms: result.details.fastapi.latency_ms,
      details: result.details.fastapi,
    };
  }

  async checkPgVector(): Promise<{ status: string; latency_ms: number; version?: string; details?: unknown }> {
    const result = await this.pgVectorHealthIndicator.check();
    return {
      status: result.details.pgvector.status,
      latency_ms: result.details.pgvector.latency_ms,
      version: result.details.pgvector.version,
      details: result.details.pgvector,
    };
  }

  async checkNatsStats(): Promise<{ consumer_count: number; message_count: number; bytes: number }> {
    return this.natsHealthIndicator.getStreamStats();
  }

  async checkPostgresLatency(): Promise<{ status: string; latency_ms: number }> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs > 500 ? 'degraded' : 'ok',
        latency_ms: latencyMs,
      };
    } catch (error) {
      return {
        status: 'down',
        latency_ms: Date.now() - start,
      };
    }
  }
}

// Export the interface for the controller
export type { HealthStatus };
