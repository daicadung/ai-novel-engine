import { CausalGraph, TraversalLimits } from './CausalGraph.js';
import { db } from '@ane/database';

export class CausalImpactAnalyzer {
  /**
   * Counterfactual / Impact Analysis tool.
   * Returns what WOULD happen or WHAT has happened downstream of an event.
   * Does NOT mutate canonical state.
   */
  static async analyzeImpact(novelId: string, eventId: string, limits?: TraversalLimits) {
    const traversal = await CausalGraph.traverseDownstream(novelId, eventId, limits);

    const affectedCharacters = new Set<string>();
    const affectedLocations = new Set<string>();
    
    // Extract directly affected entities from the graph nodes
    for (const node of traversal.nodes) {
      for (const target of (node.targetIds as string[])) {
        // Just bucket them generally for the report, in reality we'd use entity metadata
        affectedCharacters.add(target);
      }
    }

    // Check for active dependencies that might be affected by these entities
    const allTargets = Array.from(affectedCharacters);
    let affectedDependencies: any[] = [];
    
    if (allTargets.length > 0) {
      affectedDependencies = await db.causalDependencyRecord.findMany({
        where: {
          novelId,
          status: 'ACTIVE',
          dependentEntityId: { in: allTargets }
        }
      });
    }

    return {
      directImpacts: traversal.edges.filter(e => e.causeEventId === eventId).length,
      indirectImpacts: traversal.edges.length - traversal.edges.filter(e => e.causeEventId === eventId).length,
      affectedEntities: allTargets,
      affectedDependencies: affectedDependencies.map(d => d.id),
      graphNodes: traversal.nodes.length,
      graphEdges: traversal.edges.length,
    };
  }
}
