import { JobType, JobPayload, ArchitectJobPayload, PlannerJobPayload, SceneJobPayload, ProseJobPayload } from '@ane/core';
import { ArchitectManager } from '../architect/manager.js';
import { StoryPlannerManager } from '../planner/manager.js';
import { SceneManager } from '../scene/manager.js';
import { ProseManager } from '../prose/manager.js';

export class JobDispatcher {
  private architectManager: ArchitectManager;
  private plannerManager: StoryPlannerManager;
  private sceneManager: SceneManager;
  private proseManager: ProseManager;

  constructor() {
    this.architectManager = new ArchitectManager();
    this.plannerManager = new StoryPlannerManager();
    this.sceneManager = new SceneManager();
    this.proseManager = new ProseManager();
  }

  async dispatch(type: JobType, payload: JobPayload): Promise<any> {
    switch (type) {
      case JobType.ARCHITECT_STAGE: {
        const p = payload as ArchitectJobPayload;
        return await this.architectManager.runStage(p.novelId, p.stage as any, p.isRetry);
      }
      case JobType.PLANNER_STAGE: {
        const p = payload as PlannerJobPayload;
        return await this.plannerManager.runStage(p.novelId, p.stage as any, p.parentId);
      }
      case JobType.SCENE_GENERATION: {
        const p = payload as SceneJobPayload;
        return await this.sceneManager.runStage(p.novelId, p.chapterId, p.previousSnapshotId);
      }
      case JobType.PROSE_GENERATION: {
        const p = payload as ProseJobPayload;
        return await this.proseManager.runProseGeneration(p.novelId, p.chapterId, p.scenePlanVersionId, p.previousSnapshotId || null);
      }
      case JobType.PROSE_REVISION: {
        throw new Error("PROSE_REVISION is not implemented yet in ProseManager");
      }
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }
}
