import { MemoryHints } from '../core/hints';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

export function buildMemorySystemPrompt(): string {
  return 'You are an expert story continuity extractor. Your task is to analyze a chapter of a novel and extract specific state changes (deltas) for characters, locations, items, relationships, plot threads, and major story events.\n\n' +
         'Output strictly valid JSON matching this schema:\n' +
         '{\n' +
         '  "chapter_number": number,\n' +
         '  "character_deltas": [{ "character_name": "...", "status": "...", "location_name": "...", "notes": "..." }],\n' +
         '  "relationship_deltas": [{ "character_a_name": "...", "character_b_name": "...", "relationship_change": "..." }],\n' +
         '  "location_deltas": [{ "location_name": "...", "state_changes": {} }],\n' +
         '  "item_deltas": [{ "item_name": "...", "new_owner_name": "...", "new_location_name": "...", "state_changes": {} }],\n' +
         '  "plot_thread_deltas": [{ "thread_title": "...", "status": "open|active|resolved|dropped", "development_summary": "..." }],\n' +
         '  "story_events": [{ "title": "...", "description": "...", "event_type": "...", "payload": {} }],\n' +
         '  "foreshadowing": [{ "description": "...", "target_arc": "..." }]\n' +
         '}\n\n' +
         'Do not wrap your output in markdown. Return plain JSON only.';
}

export function buildMemoryUserPrompt(draft: ChapterDraft, hints: MemoryHints): string {
  return 'Please extract memory deltas from the following chapter.\n\n' +
         'Chapter Number: ' + hints.chapter_number + '\n\n' +
         'Hints to guide your extraction:\n' +
         '- Summary: ' + hints.summary + '\n' +
         '- Introduced Facts: ' + hints.introduced_facts.join('; ') + '\n' +
         '- Advanced Plot Threads: ' + hints.advanced_plot_threads.join('; ') + '\n' +
         '- Continuity Risks: ' + hints.continuity_risks.join('; ') + '\n\n' +
         'Chapter Content:\n' +
         '---\n' +
         draft.content + '\n' +
         '---\n\n' +
         'Remember: Return strictly the valid JSON structure requested.';
}
