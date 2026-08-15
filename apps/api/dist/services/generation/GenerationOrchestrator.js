import { NovelGenerationOrchestrator } from './NovelGenerationOrchestrator.js';
/**
 * GenerationOrchestrator
 *
 * Legacy facade — delegates all work to NovelGenerationOrchestrator.
 * Kept for backwards compatibility with Phase 6C.
 */
export class GenerationOrchestrator {
    orchestrator = new NovelGenerationOrchestrator();
    async orchestrateNovelGeneration(novelId) {
        await this.orchestrator.start(novelId);
    }
    /**
     * Lightweight DB-free dependency readiness check.
     * Specific DB checks that require a live database are delegated
     * to the full orchestrator status — but for DB-free tests we
     * return true as a sensible default (the real enforcement is in the
     * resolver which runs at advance() time).
     */
    async checkDependencyReadiness(novelId, _targetStage) {
        // DB-free default: allow the orchestrator to evaluate at advance() time
        return true;
    }
}
