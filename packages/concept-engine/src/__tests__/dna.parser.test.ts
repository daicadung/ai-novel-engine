import { describe, it, expect } from 'vitest';
import { parseStoryDna } from '../parsers/dna.parser';

describe('Story DNA Parser', () => {
  it('parses valid json', () => {
    const json = `{
      "concept_dna": { "tone": "dark" },
      "world_dna": { "magic": "low" },
      "character_dna": {},
      "power_system_dna": {},
      "faction_dna": {},
      "plot_dna": {},
      "arc_dna": {},
      "event_dna": {},
      "ending_dna": {}
    }`;
    const result = parseStoryDna(json);
    expect(result.concept_dna.tone).toBe('dark');
    expect(result.world_dna.magic).toBe('low');
  });

  it('throws on missing required layer', () => {
    const json = `{
      "world_dna": { "magic": "low" },
      "character_dna": {},
      "power_system_dna": {},
      "faction_dna": {},
      "plot_dna": {},
      "arc_dna": {},
      "event_dna": {},
      "ending_dna": {}
    }`;
    expect(() => parseStoryDna(json)).toThrow('Missing or invalid required plain object field "concept_dna"');
  });

  it('throws when layer is an array', () => {
    const json = `{
      "concept_dna": { "tone": "dark" },
      "world_dna": [],
      "character_dna": {},
      "power_system_dna": {},
      "faction_dna": {},
      "plot_dna": {},
      "arc_dna": {},
      "event_dna": {},
      "ending_dna": {}
    }`;
    expect(() => parseStoryDna(json)).toThrow('Missing or invalid required plain object field "world_dna"');
  });

  it('throws when layer is null', () => {
    const json = `{
      "concept_dna": { "tone": "dark" },
      "world_dna": {},
      "character_dna": null,
      "power_system_dna": {},
      "faction_dna": {},
      "plot_dna": {},
      "arc_dna": {},
      "event_dna": {},
      "ending_dna": {}
    }`;
    expect(() => parseStoryDna(json)).toThrow('Missing or invalid required plain object field "character_dna"');
  });
});
