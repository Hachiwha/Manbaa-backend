import { IsEmail, IsEnum } from 'class-validator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
export class CreateWorkspaceInvitationDto { @IsEmail() email: string; @IsEnum(WorkspaceRole) role: WorkspaceRole; }
