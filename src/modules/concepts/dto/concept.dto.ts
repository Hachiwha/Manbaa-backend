import { IsString, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConceptDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class GenerateConceptDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  prompt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class UpdateConceptDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class EvaluateConceptDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  feedback: string;

  @ApiPropertyOptional()
  @IsOptional()
  score?: number;
}
