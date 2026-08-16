import { ChapterDraft, WriterContext } from '@ai-novel-engine/chapter-writer';
import { ContinuityReport } from '../types';

export function buildRepairPrompt(draft: ChapterDraft, report: ContinuityReport, context: WriterContext): string {
  const issuesList = report.issues.map(i => `- [${i.severity.toUpperCase()}] ${i.description} (Rule: ${i.rule_violated || 'N/A'})`).join('\n');

  return 'You must revise the following chapter to fix identified continuity issues.\n\n' +
         'Identified Issues:\n' +
         issuesList + '\n\n' +
         'Original Chapter Content:\n' +
         '---\n' +
         draft.content + '\n' +
         '---\n\n' +
         'Chapter Outline Context:\n' +
         JSON.stringify(context.target_outline.outline || {}, null, 2) + '\n\n' +
         'Please rewrite the chapter content to resolve all continuity errors while preserving the style and narrative progression. Return only valid JSON for the ChapterDraft.';
}
