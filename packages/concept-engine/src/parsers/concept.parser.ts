import { ConceptCandidate } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseConceptCandidates(jsonText: string): { candidates: ConceptCandidate[], rawPayload: unknown } {
  let parsed: unknown;
  try {
    // Basic sanitization in case LLM wraps JSON in markdown blocks
    let cleanText = jsonText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    parsed = JSON.parse(cleanText);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ConceptCandidates JSON: ${msg}`);
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.candidates)) {
    throw new Error('Invalid ConceptCandidates payload: Missing "candidates" array.');
  }

  const candidates: ConceptCandidate[] = [];

  for (let i = 0; i < parsed.candidates.length; i++) {
    const item = parsed.candidates[i];
    if (!isPlainObject(item)) {
      throw new Error(`Candidate ${i} is not an object`);
    }
    if (typeof item.title !== 'string') {
      throw new Error(`Candidate ${i} is missing required string field: "title"`);
    }
    if (typeof item.premise !== 'string') {
      throw new Error(`Candidate ${i} is missing required string field: "premise"`);
    }

    candidates.push({
      title: item.title,
      premise: item.premise,
      genre: typeof item.genre === 'string' ? item.genre : undefined,
      setting: typeof item.setting === 'string' ? item.setting : undefined,
      protagonist_archetype: typeof item.protagonist_archetype === 'string' ? item.protagonist_archetype : undefined,
      theme: typeof item.theme === 'string' ? item.theme : undefined,
      conflict: typeof item.conflict === 'string' ? item.conflict : undefined,
      progression_model: typeof item.progression_model === 'string' ? item.progression_model : undefined,
      power_system: typeof item.power_system === 'string' ? item.power_system : undefined,
      narrative_structure: typeof item.narrative_structure === 'string' ? item.narrative_structure : undefined,
      ending_direction: typeof item.ending_direction === 'string' ? item.ending_direction : undefined,
    });
  }

  return { candidates, rawPayload: parsed };
}
