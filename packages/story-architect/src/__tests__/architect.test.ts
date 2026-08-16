import { describe, it, expect } from 'vitest';
import { LlmGateway, MockAdapter } from '@ai-novel-engine/llm-gateway';
import { StoryArchitect } from '../core/architect';

describe('StoryArchitect', () => {
  it('generates a complete story bible via MockAdapter', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.setMockResponse('mock-bible', {
      provider: 'mock',
      model: 'mock-bible',
      message: {
        role: 'assistant',
        content: JSON.stringify({
          bible: { premise: 'p', genre: 'g', tone: 't', style_guide: { s: 1 }, rules: { r: 1 } },
          world: { name: 'w', description: 'd', rules: { r: 1 }, history: { h: 1 } },
          locations: [],
          factions: [],
          characters: [],
          items: [],
          abilities: [],
          timeline: {
            name: 'tl', description: 'd', events: []
          },
          plot_threads: []
        })
      }
    });

    const gateway = new LlmGateway({ mock: mockAdapter });
    const architect = new StoryArchitect(gateway, { provider: 'mock', model: 'mock-bible' });

    const result = await architect.generateStoryBible({
      title: 'Title',
      concept: { title: 'T', premise: 'P' },
      dna: {
        concept_dna: {}, world_dna: {}, character_dna: {}, power_system_dna: {},
        faction_dna: {}, plot_dna: {}, arc_dna: {}, event_dna: {}, ending_dna: {}
      }
    });

    expect(result.draft.world.name).toBe('w');
  });
});
