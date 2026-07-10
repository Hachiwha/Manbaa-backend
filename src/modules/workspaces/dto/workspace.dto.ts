import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
export class CreateWorkspaceDto {
  @IsString() @MinLength(1) @MaxLength(200) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
  @IsInt() @Min(1) version: number;
}
