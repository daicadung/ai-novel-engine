import { ExtractedMemory } from '../types';

export function parseMemoryOutput(rawPayload: string): ExtractedMemory {
  const cleaned = rawPayload.trim();
  if (cleaned.startsWith('```')) {
    throw new Error('Memory parser failed: markdown code blocks are not valid memory JSON.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error('Memory parser failed: output is not valid JSON. Ensure you return ONLY JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Memory parser failed: output must be a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.chapter_number !== 'number') {
    throw new Error('Memory parser failed: missing or invalid chapter_number.');
  }
  if (!Array.isArray(obj.character_deltas)) {
    throw new Error('Memory parser failed: character_deltas must be an array.');
  }
  if (!Array.isArray(obj.relationship_deltas)) {
    throw new Error('Memory parser failed: relationship_deltas must be an array.');
  }
  if (!Array.isArray(obj.location_deltas)) {
    throw new Error('Memory parser failed: location_deltas must be an array.');
  }
  if (!Array.isArray(obj.item_deltas)) {
    throw new Error('Memory parser failed: item_deltas must be an array.');
  }
  if (!Array.isArray(obj.plot_thread_deltas)) {
    throw new Error('Memory parser failed: plot_thread_deltas must be an array.');
  }
  if (!Array.isArray(obj.story_events)) {
    throw new Error('Memory parser failed: story_events must be an array.');
  }
  if (!Array.isArray(obj.foreshadowing)) {
    throw new Error('Memory parser failed: foreshadowing must be an array.');
  }

  return parsed as ExtractedMemory;
}
