import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { WORKSPACE_BUCKETS, WorkspaceStorageService } from './workspace-storage.service';

describe('WorkspaceStorageService path security', () => {
  const config = {
    getOrThrow: (key: string) => (key.endsWith('port') ? 9000 : key.endsWith('useSsl') ? false : 'x'),
    get: (_key: string, fallback: string) => fallback,
  };
  const service = new WorkspaceStorageService(config as never);
  const ctx = { organizationId: 'org', workspaceId: 'ws' };

  it('builds canonical paths', () =>
    expect(service.buildWorkspaceObjectPath(ctx, 'asset', 'id', 1, 'file.png')).toBe('org/ws/asset/id/1/file.png'));

  it.each(['../x', '%2e%2e/x', 'org/other/a/i/1/x', '/org/ws/a/i/1/x'])(
    'rejects traversal or cross-workspace key %s',
    (key) => {
      const fn = () => service.validateWorkspaceObjectPath(ctx, WORKSPACE_BUCKETS[2], key);
      if (key.includes('other')) expect(fn).toThrow(ForbiddenException);
      else expect(fn).toThrow(BadRequestException);
    },
  );
});
