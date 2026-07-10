import { randomUUID } from 'crypto';

export const DOMAIN_EVENT_SCHEMA_VERSION = 1 as const;

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  schemaVersion: number;
  eventId: string;
  eventType: string;
  organizationId: string;
  workspaceId?: string;
  userId: string;
  correlationId: string;
  causationId?: string;
  stateVersion?: number;
  timestamp: string;
  payload: TPayload;
}

export type CreateDomainEventInput<TPayload extends Record<string, unknown>> = Omit<
  DomainEvent<TPayload>,
  'schemaVersion' | 'eventId' | 'timestamp'
> &
  Partial<Pick<DomainEvent<TPayload>, 'schemaVersion' | 'eventId' | 'timestamp'>>;

export function createDomainEvent<TPayload extends Record<string, unknown>>(
  input: CreateDomainEventInput<TPayload>,
): DomainEvent<TPayload> {
  return {
    schemaVersion: input.schemaVersion ?? DOMAIN_EVENT_SCHEMA_VERSION,
    eventId: input.eventId ?? randomUUID(),
    eventType: input.eventType,
    organizationId: input.organizationId,
    ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
    userId: input.userId,
    correlationId: input.correlationId,
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.stateVersion === undefined ? {} : { stateVersion: input.stateVersion }),
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload,
  };
}

export function assertDomainEvent(value: unknown): asserts value is DomainEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Domain event must be an object');
  }

  const event = value as Record<string, unknown>;
  const requiredStrings = [
    'eventId',
    'eventType',
    'organizationId',
    'userId',
    'correlationId',
    'timestamp',
  ];
  for (const field of requiredStrings) {
    if (typeof event[field] !== 'string' || event[field] === '') {
      throw new TypeError(`Domain event ${field} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(event.schemaVersion) || (event.schemaVersion as number) < 1) {
    throw new TypeError('Domain event schemaVersion must be a positive integer');
  }
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw new TypeError('Domain event payload must be an object');
  }
  if (Number.isNaN(Date.parse(event.timestamp as string))) {
    throw new TypeError('Domain event timestamp must be ISO-8601 compatible');
  }
}
