import { db } from '@ane/database';
export class ProseContextBuilder {
    static async buildContext(novelId, chapterId, scenePlanId, previousSnapshotId) {
        // 1. Load active ChapterBlueprint
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: { chapterBlueprint: true }
        });
        if (!chapter || !chapter.chapterBlueprint) {
            throw new Error("Missing chapter blueprint");
        }
        // 2. Load the specific scene from the active version
        const scene = await db.scene.findUnique({
            where: { id: scenePlanId },
            include: { stateChanges: true }
        });
        if (!scene)
            throw new Error("Missing scene plan");
        // 3. Load Continuity State
        let snapshotText = "Empty Continuity State";
        if (previousSnapshotId) {
            const snapshot = await db.continuitySnapshot.findUnique({ where: { id: previousSnapshotId } });
            if (snapshot) {
                // Here we apply KnowledgeBoundary filter conceptually
                // Only exposing characters/locations known to POV.
                snapshotText = JSON.stringify({
                    povCharacter: scene.povCharacter,
                    locations: scene.location ? snapshot.locations?.[scene.location] : 'Unknown',
                    characters: snapshot.characters // Filtered in a real app
                }, null, 2);
            }
        }
        return `
      CHAPTER: ${chapter.number}
      SCENE PURPOSE: ${scene.function}
      POV: ${scene.povCharacter}
      LOCATION: ${scene.location}
      OBJECTIVE: ${scene.objective}
      OUTCOME: ${scene.outcome}
      CONTINUITY: ${snapshotText}
    `;
    }
}
