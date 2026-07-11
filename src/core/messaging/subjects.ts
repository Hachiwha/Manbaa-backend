// ── Canonical NATS Subject Registry ──
// Source of truth: contracts/nats-subjects.json
// Both NestJS and FastAPI MUST reference this file.
// Do not add subjects here without updating the canonical registry.

/**
 * NEW canonical subjects (workspace.<domain>.<action>.<status>)
 * Used by new code. Old subjects below retain compatibility.
 */
export const SUBJECTS_V2 = {
  // AI Task lifecycle
  AI_TASK_REQUESTED: 'workspace.ai.task.requested',
  AI_TASK_STARTED: 'workspace.ai.task.started',
  AI_TASK_PROGRESS: 'workspace.ai.task.progress',
  AI_TASK_COMPLETED: 'workspace.ai.task.completed',
  AI_TASK_FAILED: 'workspace.ai.task.failed',
  AI_TASK_CANCEL_REQUESTED: 'workspace.ai.task.cancel.requested',
  AI_TASK_CANCELLED: 'workspace.ai.task.cancelled',

  // Source / Document processing
  SOURCE_PROCESS_REQUESTED: 'workspace.source.process.requested',
  SOURCE_PROCESSING: 'workspace.source.processing',
  SOURCE_EXTRACTED: 'workspace.source.extracted',
  SOURCE_INDEXED: 'workspace.source.indexed',
  SOURCE_FAILED: 'workspace.source.failed',

  // Research
  RESEARCH_REQUESTED: 'workspace.research.requested',
  RESEARCH_PROGRESS: 'workspace.research.progress',
  RESEARCH_COMPLETED: 'workspace.research.completed',
  RESEARCH_FAILED: 'workspace.research.failed',

  // Canvas analysis
  CANVAS_ANALYZE_REQUESTED: 'workspace.canvas.analyze.requested',
  CANVAS_ANALYSIS_COMPLETED: 'workspace.canvas.analysis.completed',

  // Canvas AI preview
  CANVAS_AI_PREVIEW_REQUESTED: 'workspace.canvas.ai.preview.requested',

  // Concept generation/evaluation
  CONCEPT_GENERATE_REQUESTED: 'workspace.concept.generate.requested',
  CONCEPT_GENERATION_STARTED: 'workspace.concept.generation.started',
  CONCEPT_GENERATION_PROGRESS: 'workspace.concept.generation.progress',
  CONCEPT_GENERATED: 'workspace.concept.generated',
  CONCEPT_GENERATION_FAILED: 'workspace.concept.generation.failed',
  CONCEPT_EVALUATE_REQUESTED: 'workspace.concept.evaluate.requested',
  CONCEPT_EVALUATED: 'workspace.concept.evaluated',

  // Asset generation
  ASSET_GENERATE_REQUESTED: 'workspace.asset.generate.requested',
  ASSET_GENERATION_STARTED: 'workspace.asset.generation.started',
  ASSET_GENERATION_PROGRESS: 'workspace.asset.generation.progress',
  ASSET_GENERATED: 'workspace.asset.generated',
  ASSET_GENERATION_FAILED: 'workspace.asset.generation.failed',
  ASSET_VARIATIONS_REQUESTED: 'workspace.asset.variations.requested',

  // Export
  EXPORT_REQUESTED: 'workspace.export.requested',
  EXPORT_STARTED: 'workspace.export.started',
  EXPORT_PROGRESS: 'workspace.export.progress',
  EXPORT_COMPLETED: 'workspace.export.completed',
  EXPORT_FAILED: 'workspace.export.failed',
  EXPORT_CANCEL_REQUESTED: 'workspace.export.cancel.requested',

  // Worker heartbeats
  WORKER_HEARTBEAT: 'worker.heartbeat',
  WORKER_HEALTH_CHANGED: 'worker.health.changed',
} as const;

/**
 * LEGACY subjects — retained for backward compatibility.
 * New code should use SUBJECTS_V2.
 * These are mapped to V2 equivalents in the canonical registry.
 */
export const SUBJECTS = {
  AI_TASKS_NEW: 'ai.tasks.new',
  AI_TASKS_RESULT: 'ai.tasks.result',
  AI_TASKS_PROGRESS: 'ai.tasks.progress',
  AI_TASKS_DIVERGENCE: 'ai.tasks.divergence',
  AI_TASKS_DIVERGENCE_RESULT: 'ai.tasks.divergence.result',
  AI_CONTEXT_LOAD: 'ai.context.load',
  DOCUMENT_PREPROCESS: 'document.preprocess',
  DOCUMENT_PREPROCESS_RESULT: 'document.preprocess.result',
  WORKFLOW_UPDATED: 'workflow.events.updated',
  SESSION_FINALIZED: 'session.events.finalized',
  SYSTEM_HEALTH_PING: 'system.health.ping',
  DEAD_LETTER_PREFIX: 'dead.ppp.',
} as const;

// Compatibility mapping: legacy subject → canonical subject
export const SUBJECT_COMPATIBILITY: Record<string, string> = {
  'ai.tasks.new': SUBJECTS_V2.AI_TASK_REQUESTED,
  'ai.tasks.progress': SUBJECTS_V2.AI_TASK_PROGRESS,
  'ai.tasks.complete': SUBJECTS_V2.AI_TASK_COMPLETED,
  'ai.tasks.error': SUBJECTS_V2.AI_TASK_FAILED,
  'ai.tasks.result': SUBJECTS_V2.AI_TASK_COMPLETED,
  'ai.context.load': SUBJECTS_V2.AI_TASK_REQUESTED,
  'document.preprocess': SUBJECTS_V2.SOURCE_PROCESS_REQUESTED,
  'document.preprocess.result': SUBJECTS_V2.SOURCE_EXTRACTED,
  'workflow.events.updated': SUBJECTS_V2.CANVAS_ANALYSIS_COMPLETED,
  'session.events.finalized': SUBJECTS_V2.AI_TASK_COMPLETED,
};

export function resolveSubject(legacySubject: string): string {
  return SUBJECT_COMPATIBILITY[legacySubject] ?? legacySubject;
}

export const CONSUMERS = {
  AI_RESULT: 'nestjs-ai-result',
  AI_PROGRESS: 'nestjs-ai-progress',
  DIVERGENCE_RESULT: 'nestjs-divergence-result',
  DOCUMENT_PREPROCESS_RESULT: 'nestjs-document-preprocess-result',
  HEALTH_PING: 'nestjs-health-ping',
} as const;

export const STREAM_SUBJECTS = [
  // V2 subjects
  'workspace.ai.task.*',
  'workspace.ai.task.>',
  'workspace.source.*',
  'workspace.source.>',
  'workspace.research.*',
  'workspace.research.>',
  'workspace.canvas.*',
  'workspace.canvas.>',
  'workspace.concept.*',
  'workspace.concept.>',
  'workspace.asset.*',
  'workspace.asset.>',
  'workspace.export.*',
  'workspace.export.>',
  'worker.*',
  'worker.>',
  // Legacy compatibility subjects
  'ai.tasks.*',
  'ai.tasks.>',
  'ai.context.*',
  'document.*',
  'document.>',
  'workflow.events.*',
  'session.events.*',
  'system.health.*',
  'dead.ppp.>',
] as const;

export type SubjectV2Key = keyof typeof SUBJECTS_V2;
export type SubjectKey = keyof typeof SUBJECTS;
export type ConsumerKey = keyof typeof CONSUMERS;
