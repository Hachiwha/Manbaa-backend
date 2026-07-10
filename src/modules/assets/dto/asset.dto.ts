import { IsString, IsOptional, IsObject, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '../entities/asset.entity';

export class CreateAssetDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type: AssetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class GenerateAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  prompt: string;

  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type: AssetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class UpdateAssetDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class VariationsAssetDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  prompt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
