import { ChapterDraft } from '../types';

export function parseChapterDraft(rawPayload: string): ChapterDraft {
  try {
    const cleanPayload = rawPayload.trim();
    if (cleanPayload.startsWith('```')) {
      throw new Error('Markdown code blocks are not valid ChapterDraft JSON.');
    }

    const parsed = JSON.parse(cleanPayload) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed output is not a JSON object.');
    }

    const draft = parsed as Record<string, unknown>;

    if (typeof draft.title !== 'string' || draft.title.trim() === '') {
      throw new Error('Missing or empty title.');
    }

    if (typeof draft.content !== 'string' || draft.content.trim() === '') {
      throw new Error('Missing or empty content.');
    }

    if (typeof draft.summary !== 'string' || draft.summary.trim() === '') {
      throw new Error('Missing or empty summary.');
    }

    if (typeof draft.word_count !== 'number' || draft.word_count <= 0) {
      throw new Error('Invalid or missing word_count.');
    }

    const validateArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val.filter(v => typeof v === 'string');
    };

    return {
      title: draft.title,
      content: draft.content,
      summary: draft.summary,
      word_count: draft.word_count,
      advanced_plot_threads: validateArray(draft.advanced_plot_threads),
      introduced_facts: validateArray(draft.introduced_facts),
      continuity_risks: validateArray(draft.continuity_risks),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ChapterDraft: ${message}`);
  }
}
