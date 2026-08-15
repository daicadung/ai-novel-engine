import { EntityType, StateChangeSchema } from '@ane/core';
import { z } from 'zod';

export class ContinuityValidator {
  
  static computeAfterState(
    beforeState: any, 
    stateChanges: z.infer<typeof StateChangeSchema>[]
  ): any {
    const afterState = JSON.parse(JSON.stringify(beforeState)); // deep clone
    
    // Track transitions within the same scene sequence to avoid conflicting changes
    const mutatedProperties = new Set<string>();

    for (const change of stateChanges) {
      const entityKey = `${change.entityType.toLowerCase()}s`; // 'characters', 'items'
      if (!afterState[entityKey]) afterState[entityKey] = {};
      
      const entityData = afterState[entityKey][change.entityId] || {};
      
      const currentValue = this.getPropertyValue(entityData, change.property);
      
      // 1. Verify previous value matches
      if (change.previousValue !== null && change.previousValue !== currentValue) {
        throw new Error(
          `Continuity Error: Property ${change.property} of ${change.entityType} ${change.entityId} ` +
          `was expected to be '${change.previousValue}' but is actually '${currentValue}'.`
        );
      }
      
      // 2. Prevent conflicting changes within the same pass for the exact property
      const mutationKey = `${change.entityId}:${change.property}`;
      if (mutatedProperties.has(mutationKey)) {
        throw new Error(
          `Continuity Error: Conflicting changes detected for ${change.entityType} ${change.entityId} ` +
          `on property ${change.property}.`
        );
      }
      mutatedProperties.add(mutationKey);

      // Apply the change
      this.setPropertyValue(entityData, change.property, change.newValue);
      afterState[entityKey][change.entityId] = entityData;
    }

    return afterState;
  }

  private static getPropertyValue(obj: any, path: string): string | null {
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return null;
      curr = curr[p];
    }
    return curr !== undefined && curr !== null ? String(curr) : null;
  }

  private static setPropertyValue(obj: any, path: string, value: string): void {
    const parts = path.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }
}
