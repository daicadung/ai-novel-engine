import { ChapterDraft } from '../types';

export function mapChapterDraftToPersistence(
  draft: ChapterDraft,
  novelId: string,
  outlineId: string | null,
  chapterNumber: number
): Record<string, unknown> {
  return {
    novel_id: novelId,
    outline_id: outlineId,
    chapter_number: chapterNumber,
    title: draft.title,
    content: draft.content,
    summary: draft.summary,
    status: 'draft',
    word_count: draft.word_count,
    metadata: {
      advanced_plot_threads: draft.advanced_plot_threads,
      introduced_facts: draft.introduced_facts,
      continuity_risks: draft.continuity_risks
    }
  };
}
