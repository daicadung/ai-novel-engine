import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

export interface MemoryHints {
  chapter_number: number;
  summary: string;
  introduced_facts: string[];
  advanced_plot_threads: string[];
  continuity_risks: string[];
}

export function extractMemoryHintsFromDraft(draft: ChapterDraft, chapterNumber: number): MemoryHints {
  return {
    chapter_number: chapterNumber,
    summary: draft.summary || '',
    introduced_facts: draft.introduced_facts || [],
    advanced_plot_threads: draft.advanced_plot_threads || [],
    continuity_risks: draft.continuity_risks || []
  };
}
