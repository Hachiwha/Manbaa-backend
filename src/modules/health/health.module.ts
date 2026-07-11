import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { FastAPIHealthIndicator } from './indicators/fast-api.health';
import { MinIOHealthIndicator } from './indicators/minio.health';
import { NatsHealthIndicator } from './indicators/nats.health';
import { ElsaHealthIndicator } from './indicators/elsa.health';
import { PgVectorHealthIndicator } from './indicators/pgvector.health';
import { NatsModule } from '../../infra/nats/nats.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Module({
  imports: [TerminusModule, NatsModule, RealtimeModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    FastAPIHealthIndicator,
    MinIOHealthIndicator,
    NatsHealthIndicator,
    ElsaHealthIndicator,
    PgVectorHealthIndicator,
    WorkerHeartbeatService,
  ],
  exports: [HealthService, WorkerHeartbeatService],
})
export class HealthModule {}
