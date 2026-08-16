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
    const raw = parsed.candidates[i] as Record<string, unknown>;
    if (!isPlainObject(raw)) {
      throw new Error(`Candidate ${i} is not an object`);
    }

    // Normalize field names: LLMs often use 'name'/'concept' instead of 'title'/'premise'
    const titleVal = (raw.title ?? raw.name ?? raw.novel_title ?? '') as string;
    const premiseVal = (raw.premise ?? raw.concept ?? raw.description ?? raw.summary ?? '') as string;

    if (!titleVal) {
      throw new Error(`Candidate ${i} is missing a title (tried: title, name, novel_title)`);
    }
    if (!premiseVal) {
      throw new Error(`Candidate ${i} is missing a premise (tried: premise, concept, description, summary)`);
    }

    candidates.push({
      title: String(titleVal),
      premise: String(premiseVal),
      genre: typeof raw.genre === 'string' ? raw.genre : undefined,
      setting: typeof raw.setting === 'string' ? raw.setting : undefined,
      protagonist_archetype: typeof raw.protagonist_archetype === 'string' ? raw.protagonist_archetype : (typeof raw.protagonist === 'string' ? raw.protagonist : undefined),
      theme: typeof raw.theme === 'string' ? raw.theme : undefined,
      conflict: typeof raw.conflict === 'string' ? raw.conflict : undefined,
      progression_model: typeof raw.progression_model === 'string' ? raw.progression_model : undefined,
      power_system: typeof raw.power_system === 'string' ? raw.power_system : undefined,
      narrative_structure: typeof raw.narrative_structure === 'string' ? raw.narrative_structure : undefined,
      ending_direction: typeof raw.ending_direction === 'string' ? raw.ending_direction : undefined,
    });
  }

  return { candidates, rawPayload: parsed };
}
