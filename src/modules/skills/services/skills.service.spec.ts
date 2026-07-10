import { ConfigService } from '@nestjs/config';

import { SkillType, UserRole } from '../../../database/enums';
import { SkillsService } from './skills.service';

describe('SkillsService', () => {
  const caller = {
    id: 'user-1',
    orgId: 'org-1',
    role: UserRole.ADMIN,
  };

  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'health.fastapiEnabled') {
        return false;
      }
      return fallback;
    }),
  } as unknown as ConfigService;

  it('creates skills without embeddings when FastAPI workers are disabled', async () => {
    const savedSkill = {
      id: 'skill-1',
      orgId: caller.orgId,
      name: 'Invoice policy',
      description: 'Approval rules',
      skillType: SkillType.DOMAIN_KNOWLEDGE,
      content: { full: 'Invoices over 1000 need approval.' },
      embedding: null,
      appliesToDomains: ['finance'],
      appliesToAgents: null,
      isActive: true,
      isMandatory: false,
      usageCount: 0,
      version: 1,
      createdBy: caller.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const skillRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ ...savedSkill, ...input })),
    };
    const service = new SkillsService(
      skillRepo as any,
      {} as any,
      { createAuditLog: jest.fn() } as any,
      config,
      { getCorrelationId: jest.fn(() => 'test-correlation') } as any,
    );

    const result = await service.create(
      {
        name: 'Invoice policy',
        description: 'Approval rules',
        skillType: SkillType.DOMAIN_KNOWLEDGE,
        content: 'Invoices over 1000 need approval.',
        appliesToDomains: ['finance'],
      } as any,
      caller,
    );

    expect(skillRepo.create).toHaveBeenCalledWith(expect.objectContaining({ embedding: null }));
    expect(result.name).toBe('Invoice policy');
  });

  it('uses text search fallback when FastAPI workers are disabled', async () => {
    const skillRepo = {
      find: jest.fn(async () => [
        {
          id: 'skill-1',
          name: 'Invoice policy',
          description: 'Approval rules',
          skillType: SkillType.DOMAIN_KNOWLEDGE,
          content: { full: 'Invoices over 1000 need approval.' },
          embedding: null,
          usageCount: 3,
        },
      ]),
    };
    const service = new SkillsService(
      skillRepo as any,
      {} as any,
      { createAuditLog: jest.fn() } as any,
      config,
      { getCorrelationId: jest.fn(() => 'test-correlation') } as any,
    );

    const results = await service.semanticSearch(
      { queryText: 'invoice approval', topK: 5, minSimilarity: 0.2 },
      caller,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'skill-1',
      name: 'Invoice policy',
      skillType: SkillType.DOMAIN_KNOWLEDGE,
    });
  });
});
