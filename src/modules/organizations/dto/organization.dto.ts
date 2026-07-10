import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrganizationRole } from '../entities/organization-member.entity';
export class CreateOrganizationDto { @IsString() @MinLength(1) @MaxLength(200) name: string; }
export class UpdateOrganizationDto { @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string; }
export class UpdateOrganizationMemberDto { @IsEnum(OrganizationRole) role: OrganizationRole; }
