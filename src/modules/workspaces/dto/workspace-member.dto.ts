import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
export class UpdateWorkspaceMemberDto { @IsEnum(WorkspaceRole) role: WorkspaceRole; }
