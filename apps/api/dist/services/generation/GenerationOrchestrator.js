import { db } from '@ane/database';
import { QueueFactory } from '../queue/index.js';
import { JobType, ArchitectStage } from '@ane/core';
export class GenerationOrchestrator {
    queueManager = QueueFactory.getQueueManager();
    async orchestrateNovelGeneration(novelId) {
        // Top-level start
        // Ensure we have a novel
        const novel = await db.novel.findUnique({ where: { id: novelId } });
        if (!novel)
            throw new Error("Novel not found");
        // Enqueue Architect CONCEPT
        await this.queueManager.addJob(JobType.ARCHITECT_STAGE, {
            novelId,
            stage: ArchitectStage.CONCEPT
        });
    }
    async checkDependencyReadiness(novelId, targetStage) {
        // In a real app, this checks if the parent outputs exist.
        // For Phase 6C, we return true for simplicity or implement light checks.
        if (targetStage === 'SCENE_GENERATION') {
            const plan = await db.storyPlan.findUnique({ where: { novelId } });
            if (!plan)
                return false;
            const canonical = await db.storyPlanVersion.findFirst({
                where: { planId: plan.id, isCanonical: true }
            });
            return !!canonical;
        }
        return true;
    }
}
