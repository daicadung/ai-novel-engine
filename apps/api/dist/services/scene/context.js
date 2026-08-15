import { db } from '@ane/database';
export class SceneContextBuilder {
    static async buildContext(novelId, chapterId, previousSnapshotId) {
        const chapter = await db.chapter.findUnique({
            where: { id: chapterId },
            include: {
                chapterBlueprint: true
            }
        });
        if (!chapter)
            throw new Error("Chapter not found");
        // Fetch the previous snapshot if provided, otherwise find the latest canonical snapshot for previous chapter
        let snapshot = null;
        if (previousSnapshotId) {
            snapshot = await db.continuitySnapshot.findUnique({ where: { id: previousSnapshotId } });
        }
        else {
            snapshot = await db.continuitySnapshot.findFirst({
                where: { novelId, chapterNumber: chapter.number - 1, status: 'CANONICAL' },
                orderBy: { createdAt: 'desc' }
            });
        }
        return `
Chapter Blueprint: ${JSON.stringify(chapter.chapterBlueprint, null, 2)}
Previous Continuity Snapshot: ${snapshot ? JSON.stringify(snapshot, null, 2) : 'None (Start of story)'}
`;
    }
}
