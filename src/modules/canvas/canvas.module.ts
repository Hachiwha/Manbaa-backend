import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditModule } from "../audit/audit.module";
import { Workflow } from "../workflows/entities/workflow.entity";
import { WorkflowVersion } from "../workflows/entities/workflow-version.entity";
import { Canvas } from "./entities/canvas.entity";
import { CanvasObject } from "./entities/canvas-object.entity";
import { CanvasOperation } from "./entities/canvas-operation.entity";
import { CanvasSnapshot } from "./entities/canvas-snapshot.entity";
import { CanvasVersion } from "./entities/canvas-version.entity";
import {
  CanvasController,
  CanvasObjectController,
} from "./controllers/canvas.controller";
import { CanvasService } from "./services/canvas.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Canvas,
      CanvasObject,
      CanvasOperation,
      CanvasSnapshot,
      CanvasVersion,
      Workflow,
      WorkflowVersion,
    ]),
    AuditModule,
  ],
  controllers: [CanvasController, CanvasObjectController],
  providers: [CanvasService],
  exports: [CanvasService],
})
export class CanvasModule {}
