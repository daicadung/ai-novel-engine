import { GenerationEvent } from '@ane/core';

// Phase 9 event types
export type Phase9EventType =
  | 'NOVEL_GENERATION_STARTED'
  | 'STAGE_ADVANCED'
  | 'CHAPTER_STARTED'
  | 'CHAPTER_COMPLETED'
  | 'CONTINUITY_CONFLICT'
  | 'QUALITY_GATE_FAILED'
  | 'REVISION_STARTED'
  | 'CHAPTER_BLOCKED'
  | 'NOVEL_PAUSED'
  | 'NOVEL_RESUMED'
  | 'NOVEL_COMPLETED'
  | 'STORY_STATE_PROMOTED'
  | 'CHAPTER_MEMORY_CREATED'
  | 'DEPENDENCY_INVALIDATED';

export interface Phase9Event {
  type: Phase9EventType;
  novelId: string;
  chapterId?: string;
  jobId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class ObservabilityManager {
  private static instance: ObservabilityManager;
  
  // For DB-free tests
  private events: GenerationEvent[] = [];
  private phase9Events: Phase9Event[] = [];

  private constructor() {}

  static getInstance(): ObservabilityManager {
    if (!ObservabilityManager.instance) {
      ObservabilityManager.instance = new ObservabilityManager();
    }
    return ObservabilityManager.instance;
  }

  recordEvent(event: GenerationEvent) {
    this.events.push(event);
    // In production, this would emit to Datadog, Prometheus, or save to DB.
  }

  getEvents(): GenerationEvent[] {
    return this.events;
  }

  resetMemoryStore() {
    this.events = [];
    this.phase9Events = [];
  }

  // ====================================================================
  // Phase 9 events
  // ====================================================================
  recordPhase9Event(event: Phase9Event) {
    // Sanitize: never log secrets
    const safe = { ...event };
    if (safe.metadata) {
      const { apiKey, authorization, secret, token, ...rest } = safe.metadata as any;
      safe.metadata = rest;
    }
    this.phase9Events.push(safe);
    // In production: emit to structured logging system
  }

  getPhase9Events(): Phase9Event[] {
    return [...this.phase9Events];
  }

  emitNovelStarted(novelId: string, correlationId?: string) {
    this.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      correlationId,
      timestamp: new Date(),
    });
  }

  emitChapterCompleted(novelId: string, chapterId: string, jobId?: string) {
    this.recordPhase9Event({
      type: 'CHAPTER_COMPLETED',
      novelId,
      chapterId,
      jobId,
      timestamp: new Date(),
    });
  }

  emitContinuityConflict(
    novelId: string,
    chapterId: string,
    conflictType: string,
    severity: string
  ) {
    this.recordPhase9Event({
      type: 'CONTINUITY_CONFLICT',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { conflictType, severity },
    });
  }

  emitQualityGateFailed(novelId: string, chapterId: string, reason: string) {
    this.recordPhase9Event({
      type: 'QUALITY_GATE_FAILED',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { reason },
    });
  }

  emitChapterBlocked(novelId: string, chapterId: string, reason: string) {
    this.recordPhase9Event({
      type: 'CHAPTER_BLOCKED',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { reason },
    });
  }

  emitStoryStatePromoted(novelId: string, chapterNumber: number) {
    this.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId,
      timestamp: new Date(),
      metadata: { chapterNumber },
    });
  }

  emitDependencyInvalidated(
    novelId: string,
    fromChapter: number,
    invalidatedCount: number
  ) {
    this.recordPhase9Event({
      type: 'DEPENDENCY_INVALIDATED',
      novelId,
      timestamp: new Date(),
      metadata: { fromChapter, invalidatedCount },
    });
  }
}
