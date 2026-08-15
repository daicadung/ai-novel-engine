import { db } from '@ane/database';
import { Consequence, DependencyStatus } from '@ane/core';

export class ConsequencePropagator {
  /**
   * Identifies dependent objectives, obligations, etc. that are affected by a consequence.
   * This handles creating PlanImpactReports without mutating the canonical plan.
   */
  static async propagateConsequences(novelId: string, chapterNumber: number): Promise<void> {
    // Load ACTIVE consequences for this novel that were created by the current chapter
    const activeConsequences = await db.consequenceRecord.findMany({
      where: {
        novelId,
        status: 'ACTIVE',
      },
      include: {
        // Unfortunately Prisma can't directly map relation if we didn't add it in schema,
        // but we can query the event later if needed.
      }
    });

    if (activeConsequences.length === 0) return;

    // Load active dependencies to check if any are violated
    const activeDependencies = await db.causalDependencyRecord.findMany({
      where: {
        novelId,
        status: 'ACTIVE',
      }
    });

    for (const consequence of activeConsequences) {
      if (!consequence.targetEntityId) continue;

      const violatedDeps = activeDependencies.filter(
        dep => dep.dependentEntityId === consequence.targetEntityId || dep.prerequisite.includes(consequence.targetEntityId!)
      );

      if (violatedDeps.length > 0) {
        // Invalidate dependencies
        await db.causalDependencyRecord.updateMany({
          where: { id: { in: violatedDeps.map(d => d.id) } },
          data: { status: DependencyStatus.INVALIDATED }
        });

        // Generate PlanImpactReport for any objectives depending on this entity
        // To keep it simple, we check if the entityId exists in ChapterObjective requiredEvents or target goals
        // But for bounded execution, we just look at DRAFT objectives
        const objectives = await db.chapterObjectiveRecord.findMany({
          where: {
            novelId,
            status: 'DRAFT',
            chapterNumber: { gt: chapterNumber } // Future chapters only
          }
        });

        const affectedObjectives = objectives.filter(obj => 
          (obj.characterGoals as any[])?.some(g => g.characterId === consequence.targetEntityId) ||
          (obj.requiredStateChanges as any[])?.some(c => c.entityId === consequence.targetEntityId)
        );

        if (affectedObjectives.length > 0) {
          await db.planImpactRecord.create({
            data: {
              novelId,
              causalEventId: consequence.sourceEventId, // Direct linkage to the cause
              affectedArcId: affectedObjectives[0].arcPlanId,
              affectedObjectiveIds: affectedObjectives.map(o => o.id) as any,
              affectedMilestoneIds: [] as any,
              affectedObligationIds: [] as any,
              affectedCharacterArcIds: [] as any,
              severity: 'HIGH',
              recommendedAction: 'REPLAN',
              reasoning: `Consequence (ID: ${consequence.id}) violates prerequisites for upcoming objectives involving entity ${consequence.targetEntityId}.`,
              createdAt: new Date(),
            }
          });
        }
      }
    }
  }
}
