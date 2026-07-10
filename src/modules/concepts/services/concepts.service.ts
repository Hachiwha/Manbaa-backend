import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Concept, ConceptStatus } from '../entities/concept.entity';
import { CreateConceptDto, GenerateConceptDto, UpdateConceptDto, EvaluateConceptDto } from '../dto/concept.dto';

@Injectable()
export class ConceptsService {
  constructor(
    @InjectRepository(Concept)
    private readonly repo: Repository<Concept>,
  ) {}

  async create(organizationId: string, workspaceId: string, dto: CreateConceptDto, userId: string): Promise<Concept> {
    const concept = this.repo.create({
      organizationId,
      workspaceId,
      title: dto.title,
      description: dto.description ?? null,
      status: ConceptStatus.DRAFT,
      createdBy: userId,
    });
    return this.repo.save(concept);
  }

  async list(organizationId: string, workspaceId: string): Promise<Concept[]> {
    return this.repo.find({
      where: { organizationId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(organizationId: string, workspaceId: string, conceptId: string): Promise<Concept> {
    const concept = await this.repo.findOne({ where: { id: conceptId, organizationId, workspaceId } });
    if (!concept) throw new NotFoundException('Concept not found');
    return concept;
  }

  async update(organizationId: string, workspaceId: string, conceptId: string, dto: UpdateConceptDto, userId: string): Promise<Concept> {
    const concept = await this.get(organizationId, workspaceId, conceptId);
    if (dto.title !== undefined) concept.title = dto.title;
    if (dto.description !== undefined) concept.description = dto.description;
    return this.repo.save(concept);
  }

  async requestGeneration(organizationId: string, workspaceId: string, dto: GenerateConceptDto, userId: string): Promise<Concept> {
    const concept = this.repo.create({
      organizationId,
      workspaceId,
      title: dto.prompt.slice(0, 255),
      prompt: dto.prompt,
      generationParams: dto.params ?? null,
      status: ConceptStatus.GENERATING,
      createdBy: userId,
    });
    return this.repo.save(concept);
  }

  async evaluate(organizationId: string, workspaceId: string, conceptId: string, dto: EvaluateConceptDto, userId: string): Promise<Concept> {
    const concept = await this.get(organizationId, workspaceId, conceptId);
    if (concept.status !== ConceptStatus.GENERATED) {
      throw new ForbiddenException('Only generated concepts can be evaluated');
    }
    concept.evaluationScore = dto.score ?? null;
    concept.evaluationFeedback = dto.feedback;
    concept.status = ConceptStatus.EVALUATED;
    return this.repo.save(concept);
  }

  async approve(organizationId: string, workspaceId: string, conceptId: string, userId: string): Promise<Concept> {
    const concept = await this.get(organizationId, workspaceId, conceptId);
    if (concept.status !== ConceptStatus.GENERATED && concept.status !== ConceptStatus.EVALUATED) {
      throw new ForbiddenException('Concept cannot be approved in current state');
    }
    concept.status = ConceptStatus.APPROVED;
    concept.approvedBy = userId;
    concept.approvedAt = new Date();
    return this.repo.save(concept);
  }

  async reject(organizationId: string, workspaceId: string, conceptId: string, userId: string): Promise<Concept> {
    const concept = await this.get(organizationId, workspaceId, conceptId);
    if (concept.status !== ConceptStatus.GENERATED && concept.status !== ConceptStatus.EVALUATED) {
      throw new ForbiddenException('Concept cannot be rejected in current state');
    }
    concept.status = ConceptStatus.REJECTED;
    return this.repo.save(concept);
  }
}
