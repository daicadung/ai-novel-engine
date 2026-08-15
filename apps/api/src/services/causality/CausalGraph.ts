import { db } from '@ane/database';
import { CausalEvent, CausalRelation } from '@ane/core';

export interface TraversalLimits {
  maxDepth: number;
  maxNodes: number;
  maxEdges: number;
}

export const DEFAULT_LIMITS: TraversalLimits = {
  maxDepth: 5,
  maxNodes: 100,
  maxEdges: 200,
};

export class CausalGraph {
  /**
   * Insert a new causal event into the graph.
   * Operations are idempotent based on the ID or provenance.
   */
  static async insertEvent(event: CausalEvent): Promise<void> {
    await db.causalEventRecord.upsert({
      where: { id: event.id },
      update: {}, // Immutable history; don't update if it exists
      create: {
        id: event.id,
        novelId: event.novelId,
        chapterNumber: event.chapterNumber,
        sceneId: event.sceneId,
        eventType: event.eventType,
        actorIds: event.actorIds as any,
        targetIds: event.targetIds as any,
        locationId: event.locationId,
        stateChanges: event.stateChanges as any,
        importance: event.importance,
        provenance: event.provenance,
        createdAt: event.createdAt || new Date(),
      },
    });
  }

  /**
   * Insert a causal relation between two existing events.
   */
  static async insertRelation(relation: CausalRelation): Promise<void> {
    await db.causalRelationRecord.upsert({
      where: { id: relation.id },
      update: {},
      create: {
        id: relation.id,
        novelId: relation.novelId,
        causeEventId: relation.causeEventId,
        effectEventId: relation.effectEventId,
        relationType: relation.relationType,
        strength: relation.strength,
        confidence: relation.confidence,
        temporalConstraint: relation.temporalConstraint,
        provenance: relation.provenance,
        createdAt: relation.createdAt || new Date(),
      },
    });
  }

  /**
   * Bounded downstream traversal (effects of a cause).
   * Uses iterative BFS to respect maxDepth safely without stack overflow.
   */
  static async traverseDownstream(
    novelId: string,
    startEventId: string,
    limits: TraversalLimits = DEFAULT_LIMITS
  ): Promise<{ nodes: CausalEvent[]; edges: CausalRelation[] }> {
    const nodes = new Map<string, any>();
    const edges: any[] = [];
    const queue: { eventId: string; depth: number }[] = [{ eventId: startEventId, depth: 0 }];
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();

    // Load initial node
    const root = await db.causalEventRecord.findUnique({ where: { id: startEventId } });
    if (!root || root.novelId !== novelId) return { nodes: [], edges: [] };
    
    nodes.set(root.id, root);
    visitedNodes.add(root.id);

    while (queue.length > 0) {
      if (nodes.size >= limits.maxNodes || edges.length >= limits.maxEdges) break;

      const current = queue.shift()!;
      if (current.depth >= limits.maxDepth) continue;

      // Find all relations where this event is the cause
      const outboundEdges = await db.causalRelationRecord.findMany({
        where: { novelId, causeEventId: current.eventId },
      });

      for (const edge of outboundEdges) {
        if (visitedEdges.has(edge.id)) continue; // Cycle detection
        
        edges.push(edge);
        visitedEdges.add(edge.id);

        if (edges.length >= limits.maxEdges) break;

        if (!visitedNodes.has(edge.effectEventId)) {
          const targetNode = await db.causalEventRecord.findUnique({ where: { id: edge.effectEventId } });
          if (targetNode) {
            nodes.set(targetNode.id, targetNode);
            visitedNodes.add(targetNode.id);
            queue.push({ eventId: targetNode.id, depth: current.depth + 1 });
          }
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()) as CausalEvent[],
      edges: edges as CausalRelation[],
    };
  }

  /**
   * Bounded upstream traversal (causes of an effect).
   */
  static async traverseUpstream(
    novelId: string,
    startEventId: string,
    limits: TraversalLimits = DEFAULT_LIMITS
  ): Promise<{ nodes: CausalEvent[]; edges: CausalRelation[] }> {
    const nodes = new Map<string, any>();
    const edges: any[] = [];
    const queue: { eventId: string; depth: number }[] = [{ eventId: startEventId, depth: 0 }];
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();

    const root = await db.causalEventRecord.findUnique({ where: { id: startEventId } });
    if (!root || root.novelId !== novelId) return { nodes: [], edges: [] };
    
    nodes.set(root.id, root);
    visitedNodes.add(root.id);

    while (queue.length > 0) {
      if (nodes.size >= limits.maxNodes || edges.length >= limits.maxEdges) break;

      const current = queue.shift()!;
      if (current.depth >= limits.maxDepth) continue;

      // Find all relations where this event is the effect
      const inboundEdges = await db.causalRelationRecord.findMany({
        where: { novelId, effectEventId: current.eventId },
      });

      for (const edge of inboundEdges) {
        if (visitedEdges.has(edge.id)) continue;
        
        edges.push(edge);
        visitedEdges.add(edge.id);

        if (edges.length >= limits.maxEdges) break;

        if (!visitedNodes.has(edge.causeEventId)) {
          const targetNode = await db.causalEventRecord.findUnique({ where: { id: edge.causeEventId } });
          if (targetNode) {
            nodes.set(targetNode.id, targetNode);
            visitedNodes.add(targetNode.id);
            queue.push({ eventId: targetNode.id, depth: current.depth + 1 });
          }
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()) as CausalEvent[],
      edges: edges as CausalRelation[],
    };
  }
}
