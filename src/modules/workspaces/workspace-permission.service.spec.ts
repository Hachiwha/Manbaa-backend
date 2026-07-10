import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole } from './entities/workspace-member.entity';
import { WorkspacePermissionService } from './workspace-permission.service';

describe('WorkspacePermissionService', () => {
  it.each([
    [WorkspaceRole.OWNER, true, true, true], [WorkspaceRole.ADMIN, true, true, true],
    [WorkspaceRole.EDITOR, true, true, false], [WorkspaceRole.COMMENTER, true, false, false], [WorkspaceRole.VIEWER, true, false, false],
  ])('enforces the %s permission matrix', async (role, read, edit, manage) => {
    const repo = { exist: jest.fn(({ where }) => Promise.resolve(where.role._value.includes(role))), findOne: jest.fn() };
    const service = new WorkspacePermissionService(repo as never);
    await expect(service.canRead('u', 'w')).resolves.toBe(read);
    await expect(service.canEdit('u', 'w')).resolves.toBe(edit);
    await expect(service.canManageMembers('u', 'w')).resolves.toBe(manage);
  });
  it('fails closed for missing membership', async () => {
    const service = new WorkspacePermissionService({ findOne: jest.fn().mockResolvedValue(null) } as never);
    await expect(service.requireMember('u', 'w')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
