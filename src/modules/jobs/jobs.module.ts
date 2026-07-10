import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NatsModule } from '../../infra/nats/nats.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsageModule } from '../usage/usage.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AiTaskEventsService } from './ai-task-events.service';
import { AiTasksController } from './ai-tasks.controller';
import { AiTasksService } from './ai-tasks.service';
import { AiTask } from './entities/ai-task.entity';
@Module({imports:[TypeOrmModule.forFeature([AiTask]),WorkspacesModule,UsageModule,OutboxModule,AuditModule,NotificationsModule,RealtimeModule,NatsModule],controllers:[AiTasksController],providers:[AiTasksService,AiTaskEventsService],exports:[AiTasksService,AiTaskEventsService]})
export class JobsModule{}
