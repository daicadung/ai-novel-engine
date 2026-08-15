import { describe, it, expect } from 'vitest';
import { ContinuityValidator } from '../src/services/scene/validator.js';
import { EntityType } from '@ane/core';

describe('ContinuityValidator', () => {
  it('should apply valid state transitions', () => {
    const beforeState = {
      characters: {
        char1: { location: 'Capital' }
      }
    };
    
    const changes: any[] = [{
      entityType: EntityType.CHARACTER,
      entityId: 'char1',
      property: 'location',
      previousValue: 'Capital',
      newValue: 'Forest'
    }];

    const afterState = ContinuityValidator.computeAfterState(beforeState, changes);
    expect(afterState.characters.char1.location).toBe('Forest');
  });

  it('should throw on previousValue mismatch', () => {
    const beforeState = {
      characters: {
        char1: { location: 'Capital' }
      }
    };
    
    const changes: any[] = [{
      entityType: EntityType.CHARACTER,
      entityId: 'char1',
      property: 'location',
      previousValue: 'Forest', // Wrong previous value
      newValue: 'Castle'
    }];

    expect(() => ContinuityValidator.computeAfterState(beforeState, changes)).toThrow(/expected to be 'Forest' but is actually 'Capital'/);
  });

  it('should detect conflicting transitions within same sequence', () => {
    const beforeState = {
      characters: {
        char1: { location: 'Capital' }
      }
    };
    
    const changes: any[] = [
      {
        entityType: EntityType.CHARACTER,
        entityId: 'char1',
        property: 'location',
        previousValue: 'Capital',
        newValue: 'Forest'
      },
      {
        entityType: EntityType.CHARACTER,
        entityId: 'char1',
        property: 'location',
        previousValue: 'Forest',
        newValue: 'Castle'
      }
    ];

    expect(() => ContinuityValidator.computeAfterState(beforeState, changes)).toThrow(/Conflicting changes detected/);
  });
});
