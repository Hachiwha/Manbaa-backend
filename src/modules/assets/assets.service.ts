import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { WorkspaceStorageService } from '../../infra/storage/workspace-storage.service';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { WorkspacePermissionService } from '../workspaces/workspace-permission.service';
import { CreateAssetDto, GenerateAssetDto, UpdateAssetDto, VariationsAssetDto } from './dto';
import { Asset, AssetStatus } from './entities/asset.entity';

const EDIT_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.EDITOR];

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly repo: Repository<Asset>,
    private readonly permissions: WorkspacePermissionService,
    private readonly storage: WorkspaceStorageService,
  ) {}

  async create(organizationId: string, workspaceId: string, dto: CreateAssetDto, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const asset = this.repo.create({
      organizationId,
      workspaceId,
      title: dto.title,
      type: dto.type,
      status: dto.storageKey ? AssetStatus.GENERATED : AssetStatus.DRAFT,
      metadata: dto.metadata ?? null,
      storageKey: dto.storageKey ?? null,
      mimeType: dto.mimeType ?? null,
      fileSize: dto.fileSize ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      thumbnailKey: dto.thumbnailKey ?? null,
      parentId: dto.parentId ?? null,
      createdBy: userId,
    });
    return this.repo.save(asset);
  }

  async list(organizationId: string, workspaceId: string, userId: string): Promise<Asset[]> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, Object.values(WorkspaceRole));
    return this.repo.find({ where: { organizationId, workspaceId, parentId: IsNull() }, order: { createdAt: 'DESC' } });
  }

  async getForUser(organizationId: string, workspaceId: string, assetId: string, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, Object.values(WorkspaceRole));
    return this.get(organizationId, workspaceId, assetId);
  }

  async update(organizationId: string, workspaceId: string, assetId: string, dto: UpdateAssetDto, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const asset = await this.get(organizationId, workspaceId, assetId);
    if (dto.title !== undefined) asset.title = dto.title;
    if (dto.metadata !== undefined) asset.metadata = dto.metadata;
    if (dto.storageKey !== undefined) {
      asset.storageKey = dto.storageKey;
      if (asset.status === AssetStatus.DRAFT || asset.status === AssetStatus.FAILED) {
        asset.status = AssetStatus.GENERATED;
      }
    }
    if (dto.thumbnailKey !== undefined) asset.thumbnailKey = dto.thumbnailKey;
    return this.repo.save(asset);
  }

  async requestGeneration(organizationId: string, workspaceId: string, dto: GenerateAssetDto, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const asset = this.repo.create({
      organizationId,
      workspaceId,
      title: dto.prompt.slice(0, 255),
      type: dto.type,
      status: AssetStatus.GENERATING,
      prompt: dto.prompt,
      generationParams: dto.params ?? null,
      createdBy: userId,
    });
    return this.repo.save(asset);
  }

  async requestVariation(organizationId: string, workspaceId: string, assetId: string, dto: VariationsAssetDto, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const parent = await this.get(organizationId, workspaceId, assetId);
    const rootId = parent.parentId ?? parent.id;
    const latestVersion = await this.repo.maximum('version', {
      organizationId,
      workspaceId,
      parentId: rootId,
    });
    const variation = this.repo.create({
      organizationId,
      workspaceId,
      title: `${parent.title} variation`,
      type: parent.type,
      status: AssetStatus.GENERATING,
      prompt: dto.prompt,
      generationParams: dto.params ?? null,
      parentId: rootId,
      version: Math.max(parent.version, latestVersion ?? 1) + 1,
      createdBy: userId,
    });
    return this.repo.save(variation);
  }

  async versions(organizationId: string, workspaceId: string, assetId: string, userId: string): Promise<Asset[]> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, Object.values(WorkspaceRole));
    const asset = await this.get(organizationId, workspaceId, assetId);
    const rootId = asset.parentId ?? asset.id;
    return this.repo.find({
      where: [
        { organizationId, workspaceId, id: rootId },
        { organizationId, workspaceId, parentId: rootId },
      ],
      order: { version: 'ASC', createdAt: 'ASC' },
    });
  }

  async approve(organizationId: string, workspaceId: string, assetId: string, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const asset = await this.get(organizationId, workspaceId, assetId);
    if (asset.status !== AssetStatus.GENERATED) {
      throw new ForbiddenException('Only generated assets can be approved');
    }
    asset.status = AssetStatus.APPROVED;
    asset.approvedBy = userId;
    asset.approvedAt = new Date();
    return this.repo.save(asset);
  }

  async reject(organizationId: string, workspaceId: string, assetId: string, userId: string): Promise<Asset> {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, EDIT_ROLES);
    const asset = await this.get(organizationId, workspaceId, assetId);
    if (asset.status !== AssetStatus.GENERATED) {
      throw new ForbiddenException('Only generated assets can be rejected');
    }
    asset.status = AssetStatus.REJECTED;
    return this.repo.save(asset);
  }

  async createSignedDownloadUrl(organizationId: string, workspaceId: string, assetId: string, userId: string) {
    await this.requireWorkspaceRole(organizationId, workspaceId, userId, Object.values(WorkspaceRole));
    const asset = await this.get(organizationId, workspaceId, assetId);
    if (!asset.storageKey) {
      throw new BadRequestException('Asset has no stored object');
    }
    const url = await this.storage.createSignedDownloadUrl({ organizationId, workspaceId }, this.storage.getAssetBucket(), asset.storageKey);
    return { url, expiresInSeconds: 900 };
  }

  private async get(organizationId: string, workspaceId: string, assetId: string): Promise<Asset> {
    const asset = await this.repo.findOne({ where: { id: assetId, organizationId, workspaceId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  private async requireWorkspaceRole(organizationId: string, workspaceId: string, userId: string, roles: WorkspaceRole[]) {
    const member = await this.permissions.requireRole(userId, workspaceId, roles);
    if (member.organizationId !== organizationId) {
      throw new ForbiddenException('Workspace access denied');
    }
    return member;
  }
}
