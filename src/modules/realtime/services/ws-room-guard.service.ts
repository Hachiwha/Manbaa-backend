import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Socket } from "socket.io";

import { Canvas } from "../../canvas/entities/canvas.entity";
import { Session } from '../../sessions/entities/session.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { PipelineExecution } from '../../agents/entities/pipeline-execution.entity';
import { WorkspaceMember, WorkspaceMemberStatus } from '../../workspaces/entities/workspace-member.entity';
import { OrganizationMember } from '../../organizations/entities/organization-member.entity';
import { AiTask } from '../../jobs/entities/ai-task.entity';

export interface RoomJoinResult {
  allowed: boolean;
  reason?: string;
}

interface SocketUserData {
  userId: string;
  orgId: string;
  role: string;
}

/**
 * Validates that a socket client is authorized to join a given room.
 *
 * Room patterns and their auth rules:
 * - `user:{userId}`      → self-only
 * - `canvas:{canvasId}`  → org-scoped (Canvas → Workflow.orgId)
 * - `session:{sessionId}` → org-scoped (Session → Workflow.orgId)
 * - `workflow:{workflowId}` → org-scoped (Workflow.orgId)
 * - `pipeline:{pipelineExecutionId}` → org-scoped (Pipeline → Session → Workflow.orgId)
 * - `admin-health`       → role === 'admin'
 */
@Injectable()
export class WsRoomGuardService {
  private readonly logger = new Logger(WsRoomGuardService.name);

  constructor(
    @InjectRepository(Canvas)
    private readonly canvasRepo: Repository<Canvas>,
    @InjectRepository(Session)
    private readonly sessionsRepo: Repository<Session>,
    @InjectRepository(Workflow)
    private readonly workflowsRepo: Repository<Workflow>,
    @InjectRepository(PipelineExecution)
    private readonly pipelineRepo: Repository<PipelineExecution>,
    @InjectRepository(WorkspaceMember) private readonly workspaceMembers?: Repository<WorkspaceMember>,
    @InjectRepository(OrganizationMember) private readonly organizationMembers?: Repository<OrganizationMember>,
    @InjectRepository(AiTask) private readonly aiTasks?: Repository<AiTask>,
  ) {}

  async canJoin(socket: Socket, room: string): Promise<RoomJoinResult> {
    const user = socket.data as SocketUserData;

    if (!user?.userId || !user?.orgId) {
      this.logRejection(user?.userId, room, 'Missing user context');
      return { allowed: false, reason: 'Missing user context' };
    }

    // ── user:{userId} — self-only ──
    if (room.startsWith("user:")) {
      const targetUserId = room.slice("user:".length);
      if (user.userId !== targetUserId) {
        this.logRejection(user.userId, room, "Cannot join another user's room");
        return { allowed: false, reason: "Cannot join another user's room" };
      }
      return { allowed: true };
    }

    // ── canvas:{canvasId} — org-scoped via workflow ──
    if (room.startsWith("canvas:")) {
      const canvasId = room.slice("canvas:".length);
      return this.validateCanvasOrg(user, canvasId, room);
    }

// ── organization:{organizationId} — member check ──
    if (room.startsWith('organization:')) {
      const organizationId=room.slice('organization:'.length);
      const allowed=await this.organizationMembers?.exist({where:{organizationId,userId:user.userId,active:true}});
      return allowed?{allowed:true}:{allowed:false,reason:'Organization access denied'};
    }

// ── workspace:{workspaceId} — member check ──
    if (room.startsWith('workspace:')) {
      const workspaceId=room.slice('workspace:'.length);
      return this.validateWorkspaceMember(user.userId,workspaceId);
    }

    // ── ai-task:{taskId} — workspace-scoped ──
    if (room.startsWith('ai-task:')) {
      const taskId=room.slice('ai-task:'.length);
      const task=await this.aiTasks?.findOne({where:{id:taskId},select:['id','workspaceId']});
      if(!task)return{allowed:false,reason:'AI task not found'};
      return this.validateWorkspaceMember(user.userId,task.workspaceId);
    }

    // ── session:{sessionId} — org-scoped ──
    if (room.startsWith('session:')) {
      const sessionId = room.slice('session:'.length);
      return this.validateSessionOrg(user, sessionId, room);
    }

    // ── workflow:{workflowId} — org-scoped ──
    if (room.startsWith('workflow:')) {
      const workflowId = room.slice('workflow:'.length);
      return this.validateWorkflowOrg(user, workflowId, room);
    }

    // ── pipeline:{pipelineExecutionId} — org-scoped via session ──
    if (room.startsWith('pipeline:')) {
      const pipelineId = room.slice('pipeline:'.length);
      return this.validatePipelineOrg(user, pipelineId, room);
    }

    // ── admin-health — role-gated ──
    if (room === 'admin-health') {
      if (user.role !== 'admin') {
        this.logRejection(user.userId, room, 'Admin role required');
        return { allowed: false, reason: 'Admin role required' };
      }
      return { allowed: true };
    }

    // Unknown room pattern
    this.logRejection(user.userId, room, 'Unknown room pattern');
    return { allowed: false, reason: 'Unknown room pattern' };
  }

  // ──────────────────────────────────────────────────────────────────

  private async validateSessionOrg(
    user: SocketUserData,
    sessionId: string,
    room: string,
  ): Promise<RoomJoinResult> {
    try {
      const session = await this.sessionsRepo.findOne({
        where: { id: sessionId },
        select: ['id', 'workflowId'],
      });
      if (!session) {
        this.logRejection(user.userId, room, 'Session not found');
        return { allowed: false, reason: 'Session not found' };
      }

      const workflow = await this.workflowsRepo.findOne({
        where: { id: session.workflowId, orgId: user.orgId },
        select: ['id'],
      });
      if (!workflow) {
        this.logRejection(user.userId, room, 'Session does not belong to your organization');
        return { allowed: false, reason: 'Session does not belong to your organization' };
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error(`Session org validation error: ${(error as Error).message}`);
      return { allowed: false, reason: 'Validation error' };
    }
  }

  private async validateWorkflowOrg(
    user: SocketUserData,
    workflowId: string,
    room: string,
  ): Promise<RoomJoinResult> {
    try {
      const workflow = await this.workflowsRepo.findOne({
        where: { id: workflowId, orgId: user.orgId },
        select: ['id'],
      });
      if (!workflow) {
        this.logRejection(user.userId, room, 'Workflow not found or not in your organization');
        return { allowed: false, reason: 'Workflow not found or not in your organization' };
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error(`Workflow org validation error: ${(error as Error).message}`);
      return { allowed: false, reason: 'Validation error' };
    }
  }

  private async validatePipelineOrg(
    user: SocketUserData,
    pipelineId: string,
    room: string,
  ): Promise<RoomJoinResult> {
    try {
      const pipeline = await this.pipelineRepo.findOne({
        where: { id: pipelineId },
        select: ['id', 'sessionId'],
      });
      if (!pipeline) {
        this.logRejection(user.userId, room, 'Pipeline not found');
        return { allowed: false, reason: 'Pipeline not found' };
      }

      // Delegate to session org check
      return this.validateSessionOrg(user, pipeline.sessionId, room);
    } catch (error) {
      this.logger.error(`Pipeline org validation error: ${(error as Error).message}`);
      return { allowed: false, reason: 'Validation error' };
    }
  }

  private async validateCanvasOrg(
    user: SocketUserData,
    canvasId: string,
    room: string,
  ): Promise<RoomJoinResult> {
    try {
      const canvas = await this.canvasRepo.findOne({
        where: { id: canvasId },
        select: ["id", "workflowId"],
      });
      if (!canvas) {
        this.logRejection(user.userId, room, "Canvas not found");
        return { allowed: false, reason: "Canvas not found" };
      }

      const workflow = await this.workflowsRepo.findOne({
        where: { id: canvas.workflowId, orgId: user.orgId },
        select: ["id"],
      });
      if (!workflow) {
        this.logRejection(
          user.userId,
          room,
          "Canvas does not belong to your organization",
        );
        return {
          allowed: false,
          reason: "Canvas does not belong to your organization",
        };
      }

      return { allowed: true };
    } catch (error) {
      this.logger.error(
        `Canvas org validation error: ${(error as Error).message}`,
      );
      return { allowed: false, reason: "Validation error" };
    }
  }

  private logRejection(userId: string | undefined, room: string, reason: string): void {
    this.logger.warn(
      `Room join rejected: userId=${userId ?? 'unknown'} room=${room} reason="${reason}"`,
    );
  }
  private async validateWorkspaceMember(userId: string, workspaceId: string): Promise<RoomJoinResult> {
    const allowed = await this.workspaceMembers?.exist({
      where: { userId, workspaceId, status: WorkspaceMemberStatus.ACTIVE },
    });
    return allowed
      ? { allowed: true }
      : { allowed: false, reason: 'Workspace access denied' };
  }
}
