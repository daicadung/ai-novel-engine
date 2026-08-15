import { JobType } from '@ane/core';
import { ArchitectManager } from '../architect/manager.js';
import { StoryPlannerManager } from '../planner/manager.js';
import { SceneManager } from '../scene/manager.js';
import { ProseManager } from '../prose/manager.js';
export class JobDispatcher {
    architectManager;
    plannerManager;
    sceneManager;
    proseManager;
    constructor() {
        this.architectManager = new ArchitectManager();
        this.plannerManager = new StoryPlannerManager();
        this.sceneManager = new SceneManager();
        this.proseManager = new ProseManager();
    }
    /**
     * Dispatch a generation job to the appropriate domain manager.
     * jobId is propagated so that managers can associate usage/observability with the correct GenerationJob.
     * Domain managers must NOT create their own GenerationJob records.
     */
    async dispatch(type, payload, jobId) {
        switch (type) {
            case JobType.ARCHITECT_STAGE: {
                const p = payload;
                return await this.architectManager.runStage(p.novelId, p.stage, p.isRetry, jobId);
            }
            case JobType.PLANNER_STAGE: {
                const p = payload;
                return await this.plannerManager.runStage(p.novelId, p.stage, p.parentId, jobId);
            }
            case JobType.SCENE_GENERATION: {
                const p = payload;
                return await this.sceneManager.runStage(p.novelId, p.chapterId, p.previousSnapshotId, jobId);
            }
            case JobType.PROSE_GENERATION: {
                const p = payload;
                return await this.proseManager.runProseGeneration(p.novelId, p.chapterId, p.scenePlanVersionId, p.previousSnapshotId || null, jobId);
            }
            case JobType.PROSE_REVISION: {
                throw new Error('PROSE_REVISION is not implemented yet in ProseManager');
            }
            default:
                throw new Error(`Unknown job type: ${type}`);
        }
    }
}
