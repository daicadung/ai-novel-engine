import { StoryDna } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseStoryDna(jsonText: string): StoryDna {
  let parsed: unknown;
  try {
    let cleanText = jsonText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    parsed = JSON.parse(cleanText);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse StoryDna JSON: ${msg}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Invalid StoryDna payload: Expected an object.');
  }

  const requiredLayers = [
    'concept_dna', 'world_dna', 'character_dna', 'power_system_dna', 
    'faction_dna', 'plot_dna', 'arc_dna', 'event_dna', 'ending_dna'
  ];

  for (const layer of requiredLayers) {
    if (!isPlainObject(parsed[layer])) {
      throw new Error(`Invalid StoryDna payload: Missing or invalid required plain object field "${layer}"`);
    }
  }

  return {
    concept_dna: parsed.concept_dna as Record<string, unknown>,
    world_dna: parsed.world_dna as Record<string, unknown>,
    character_dna: parsed.character_dna as Record<string, unknown>,
    power_system_dna: parsed.power_system_dna as Record<string, unknown>,
    faction_dna: parsed.faction_dna as Record<string, unknown>,
    plot_dna: parsed.plot_dna as Record<string, unknown>,
    arc_dna: parsed.arc_dna as Record<string, unknown>,
    event_dna: parsed.event_dna as Record<string, unknown>,
    ending_dna: parsed.ending_dna as Record<string, unknown>,
  };
}
