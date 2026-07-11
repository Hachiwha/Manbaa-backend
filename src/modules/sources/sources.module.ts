import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { NatsModule } from "../../infra/nats/nats.module";
import { OutboxModule } from "../outbox/outbox.module";
import { Project } from "../projects/entities/project.entity";
import { RealtimeModule } from "../realtime/realtime.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { Source, SourceLifecycleEvent, SourceVersion } from "./entities";
import { SourceLifecycleService } from "./source-lifecycle.service";
import { SourcesController } from "./sources.controller";
import { SourcesService } from "./sources.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Source,
      SourceVersion,
      SourceLifecycleEvent,
      Project,
    ]),
    WorkspacesModule,
    OutboxModule,
    NatsModule,
    RealtimeModule,
  ],
  controllers: [SourcesController],
  providers: [SourcesService, SourceLifecycleService],
  exports: [SourcesService, SourceLifecycleService],
})
export class SourcesModule {}
