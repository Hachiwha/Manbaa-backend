import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import configuration from './core/config/configuration';
import { envSchema } from './core/config/env.validation';
import { CoreModule } from './core/core.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { RolesGuard } from './core/guards/roles.guard';
import { LoggerModule } from './core/logger/logger.module';
import { AIGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { CommentsModule } from './modules/comments/comments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { MessagesModule } from './modules/messages/messages.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RulesModule } from './modules/rules/rules.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SkillsModule } from './modules/skills/skills.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { NatsModule } from './infra/nats/nats.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsageModule } from './modules/usage/usage.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { RedisModule } from './infra/redis/redis.module';
import { WorkspaceStorageModule } from './infra/storage/workspace-storage.module';
import { InternalAuthModule } from './core/internal-auth/internal-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envSchema,
    }),
    LoggerModule,
    RedisModule,
    WorkspaceStorageModule,
    InternalAuthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>('throttle.ttl'),
          limit: config.getOrThrow<number>('throttle.limit'),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('database.url'),
        synchronize: false,
        migrationsRun: true,
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    CoreModule,
    AuthModule,
    WorkspacesModule,
    NotificationsModule,
    UsageModule,
    OutboxModule,
    JobsModule,
    HealthModule,
    DocumentsModule,
    MessagesModule,
    OrganizationsModule,
    ProjectsModule,
    AIGatewayModule,
    CommentsModule,
    RealtimeModule,
    RulesModule,
    NatsModule,
    SessionsModule,
    SkillsModule,
    WorkflowsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }
