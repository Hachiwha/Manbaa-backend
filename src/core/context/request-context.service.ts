import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  userId?: string;
  orgId?: string;
  organizationId?: string;
  workspaceId?: string;
  correlationId: string;
  role?: string;
  requestStartedAt: number;
}

@Injectable()
export class RequestContextService {
  private static readonly als = new AsyncLocalStorage<RequestContext>();

  run<T>(context: Omit<RequestContext, 'requestStartedAt'> & { requestStartedAt?: number }, callback: () => T): T {
    return RequestContextService.als.run({ ...context, requestStartedAt: context.requestStartedAt ?? Date.now() }, callback);
  }

  getStore(): RequestContext | undefined {
    return RequestContextService.als.getStore();
  }

  setContext(patch: Partial<RequestContext>): void {
    const store = this.getStore();
    if (store) Object.assign(store, patch);
  }

  getCorrelationId(): string {
    return this.getStore()?.correlationId || 'system';
  }

  getOrgId(): string | undefined {
    return this.getStore()?.organizationId ?? this.getStore()?.orgId;
  }
  getOrganizationId(): string | undefined { return this.getOrgId(); }
  getWorkspaceId(): string | undefined { return this.getStore()?.workspaceId; }

  getUserId(): string | undefined {
    return this.getStore()?.userId;
  }
}
