import { db } from '@ane/database';
import { ProseStageHandler } from './handlers.js';
import { ProseContextBuilder } from './context.js';
import { ProviderFactory } from '../llm/factory.js';
import { ProseStatus } from '@prisma/client';
export class ProseManager {
    provider;
    handler;
    constructor(provider) {
        this.provider = provider || ProviderFactory.getProvider('PROSE');
        this.handler = new ProseStageHandler(this.provider);
    }
    async runProseGeneration(novelId, chapterId, scenePlanVersionId, previousSnapshotId) {
        const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
        if (!chapter)
            throw new Error("Chapter not found");
        const scenePlanVersion = await db.scenePlanVersion.findUnique({
            where: { id: scenePlanVersionId },
            include: { scenes: { orderBy: { sceneNumber: 'asc' } } }
        });
        if (!scenePlanVersion)
            throw new Error("ScenePlanVersion not found");
        const job = await db.generationJob.create({
            data: {
                novelId,
                proseStage: 'PROSE_GENERATION',
                status: 'RUNNING',
                provider: 'MockProvider',
                startedAt: new Date()
            }
        });
        try {
            const generatedScenes = [];
            for (const scene of scenePlanVersion.scenes) {
                const context = await ProseContextBuilder.buildContext(novelId, chapterId, scene.id, previousSnapshotId);
                // Configurable limits check (placeholder logic)
                const maxRetries = 3;
                const result = await this.handler.invokeWithRetries(context, scene, maxRetries);
                generatedScenes.push({
                    sceneId: scene.id,
                    content: result.content,
                    wordCount: result.wordCount,
                    validationReport: result.validationReport,
                    status: result.validationReport.passed ? ProseStatus.DRAFT : ProseStatus.REJECTED
                });
            }
            await db.$transaction(async (tx) => {
                // Fetch or create ChapterProse
                let chapterProse = await tx.chapterProse.findUnique({ where: { chapterId } });
                if (!chapterProse) {
                    chapterProse = await tx.chapterProse.create({ data: { chapterId } });
                }
                const oldVersion = await tx.chapterProseVersion.findFirst({
                    where: { chapterProseId: chapterProse.id, status: ProseStatus.CANONICAL }
                });
                const newVersionNum = oldVersion ? oldVersion.version + 1 : 1;
                const newVersion = await tx.chapterProseVersion.create({
                    data: {
                        chapterProseId: chapterProse.id,
                        sourceScenePlanVersionId: scenePlanVersionId,
                        version: newVersionNum,
                        status: ProseStatus.CANONICAL,
                    }
                });
                for (const gen of generatedScenes) {
                    await tx.sceneProse.create({
                        data: {
                            chapterProseVersionId: newVersion.id,
                            scenePlanId: gen.sceneId,
                            content: gen.content,
                            wordCount: gen.wordCount,
                            status: ProseStatus.CANONICAL,
                            validationReport: gen.validationReport
                        }
                    });
                }
                // Mark old versions as STALE
                if (oldVersion) {
                    await tx.chapterProseVersion.update({
                        where: { id: oldVersion.id },
                        data: { status: ProseStatus.STALE }
                    });
                    await tx.sceneProse.updateMany({
                        where: { chapterProseVersionId: oldVersion.id },
                        data: { status: ProseStatus.STALE }
                    });
                }
                // Update current pointer
                await tx.chapterProse.update({
                    where: { id: chapterProse.id },
                    data: { currentVersionId: newVersion.id }
                });
            });
            await db.generationJob.update({
                where: { id: job.id },
                data: { status: 'SUCCEEDED', output: { count: generatedScenes.length }, completedAt: new Date() }
            });
        }
        catch (e) {
            await db.generationJob.update({
                where: { id: job.id },
                data: { status: 'FAILED', error: { message: e.message }, completedAt: new Date() }
            });
            throw e;
        }
    }
}
