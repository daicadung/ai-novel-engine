export class ObservabilityManager {
    static instance;
    // For DB-free tests
    events = [];
    phase9Events = [];
    constructor() { }
    static getInstance() {
        if (!ObservabilityManager.instance) {
            ObservabilityManager.instance = new ObservabilityManager();
        }
        return ObservabilityManager.instance;
    }
    recordEvent(event) {
        this.events.push(event);
        // In production, this would emit to Datadog, Prometheus, or save to DB.
    }
    getEvents() {
        return this.events;
    }
    resetMemoryStore() {
        this.events = [];
        this.phase9Events = [];
    }
    // ====================================================================
    // Phase 9 events
    // ====================================================================
    recordPhase9Event(event) {
        // Sanitize: never log secrets
        const safe = { ...event };
        if (safe.metadata) {
            const { apiKey, authorization, secret, token, ...rest } = safe.metadata;
            safe.metadata = rest;
        }
        this.phase9Events.push(safe);
        // In production: emit to structured logging system
    }
    getPhase9Events() {
        return [...this.phase9Events];
    }
    emitNovelStarted(novelId, correlationId) {
        this.recordPhase9Event({
            type: 'NOVEL_GENERATION_STARTED',
            novelId,
            correlationId,
            timestamp: new Date(),
        });
    }
    emitChapterCompleted(novelId, chapterId, jobId) {
        this.recordPhase9Event({
            type: 'CHAPTER_COMPLETED',
            novelId,
            chapterId,
            jobId,
            timestamp: new Date(),
        });
    }
    emitContinuityConflict(novelId, chapterId, conflictType, severity) {
        this.recordPhase9Event({
            type: 'CONTINUITY_CONFLICT',
            novelId,
            chapterId,
            timestamp: new Date(),
            metadata: { conflictType, severity },
        });
    }
    emitQualityGateFailed(novelId, chapterId, reason) {
        this.recordPhase9Event({
            type: 'QUALITY_GATE_FAILED',
            novelId,
            chapterId,
            timestamp: new Date(),
            metadata: { reason },
        });
    }
    emitChapterBlocked(novelId, chapterId, reason) {
        this.recordPhase9Event({
            type: 'CHAPTER_BLOCKED',
            novelId,
            chapterId,
            timestamp: new Date(),
            metadata: { reason },
        });
    }
    emitStoryStatePromoted(novelId, chapterNumber) {
        this.recordPhase9Event({
            type: 'STORY_STATE_PROMOTED',
            novelId,
            timestamp: new Date(),
            metadata: { chapterNumber },
        });
    }
    emitDependencyInvalidated(novelId, fromChapter, invalidatedCount) {
        this.recordPhase9Event({
            type: 'DEPENDENCY_INVALIDATED',
            novelId,
            timestamp: new Date(),
            metadata: { fromChapter, invalidatedCount },
        });
    }
}
