import { describe, it, expect } from 'vitest';
import { ConceptEngine } from '../core/engine';
import { LlmGateway, MockAdapter } from '@ai-novel-engine/llm-gateway';

describe('ConceptEngine', () => {
  it('generates concepts and extracts DNA successfully in a sequence', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.setMockResponse('mock-concept', {
      provider: 'mock',
      model: 'mock-concept',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          candidates: [
            { title: 'T1', premise: 'P1' }
          ]
        })
      }
    });
    mockAdapter.setMockResponse('mock-dna', {
      provider: 'mock',
      model: 'mock-dna',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          concept_dna: { key: 'value' },
          world_dna: {},
          character_dna: {},
          power_system_dna: {},
          faction_dna: {},
          plot_dna: {},
          arc_dna: {},
          event_dna: {},
          ending_dna: {}
        })
      }
    });

    const gateway = new LlmGateway({ mock: mockAdapter });
    
    const conceptEngine = new ConceptEngine(gateway, { provider: 'mock', model: 'mock-concept' });
    const result = await conceptEngine.generateConcepts('Some Title');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe('T1');

    const dnaEngine = new ConceptEngine(gateway, { provider: 'mock', model: 'mock-dna' });
    const dna = await dnaEngine.extractStoryDna(result.candidates[0]);
    expect(dna.concept_dna.key).toBe('value');
    expect(dna.world_dna).toBeDefined();
    expect(dna.ending_dna).toBeDefined();
  });
});
