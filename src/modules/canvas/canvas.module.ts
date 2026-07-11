import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditModule } from "../audit/audit.module";
import { AiTask } from "../jobs/entities/ai-task.entity";
import { JobsModule } from "../jobs/jobs.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { UsageModule } from "../usage/usage.module";
import { Workflow } from "../workflows/entities/workflow.entity";
import { WorkflowVersion } from "../workflows/entities/workflow-version.entity";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { CanvasAiPreviewController } from "./controllers/canvas-ai-preview.controller";
import { CanvasAiSuggestionController } from "./controllers/canvas-ai-suggestion.controller";
import {
  CanvasController,
  CanvasObjectController,
} from "./controllers/canvas.controller";
import { AiPreviewSnapshot } from "./entities/ai-preview-snapshot.entity";
import { CanvasAiSuggestion } from "./entities/canvas-ai-suggestion.entity";
import { Canvas } from "./entities/canvas.entity";
import { CanvasObject } from "./entities/canvas-object.entity";
import { CanvasOperation } from "./entities/canvas-operation.entity";
import { CanvasSnapshot } from "./entities/canvas-snapshot.entity";
import { CanvasVersion } from "./entities/canvas-version.entity";
import { CanvasAiPreviewCoordinator } from "./services/canvas-ai-preview-coordinator.service";
import { CanvasAiPreviewService } from "./services/canvas-ai-preview.service";
import { CanvasAiSuggestionService } from "./services/canvas-ai-suggestion.service";
import { CanvasRealtimeService } from "./services/canvas-realtime.service";
import { CanvasService } from "./services/canvas.service";
import { CanvasSnapshotSerializer } from "./services/canvas-snapshot-serializer.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Canvas,
      CanvasObject,
      CanvasOperation,
      CanvasSnapshot,
      CanvasVersion,
      AiPreviewSnapshot,
      CanvasAiSuggestion,
      AiTask,
      Workflow,
      WorkflowVersion,
    ]),
    AuditModule,
    forwardRef(() => JobsModule),
    OutboxModule,
    RealtimeModule,
    UsageModule,
    WorkspacesModule,
  ],
  controllers: [
    CanvasController,
    CanvasObjectController,
    CanvasAiPreviewController,
    CanvasAiSuggestionController,
  ],
  providers: [
    CanvasService,
    CanvasRealtimeService,
    CanvasAiPreviewService,
    CanvasAiPreviewCoordinator,
    CanvasAiSuggestionService,
    CanvasSnapshotSerializer,
  ],
  exports: [CanvasService, CanvasAiSuggestionService, CanvasRealtimeService],
})
export class CanvasModule {}
