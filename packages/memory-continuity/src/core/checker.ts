import { ExtractedMemory, ContinuitySnapshot, ContinuityReport, ContinuityIssue, ContinuitySeverity } from '../types';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

export class ContinuityChecker {
  public check(draft: ChapterDraft, memory: ExtractedMemory, snapshot: ContinuitySnapshot): ContinuityReport {
    const issues: ContinuityIssue[] = [];
    let maxSeverity: ContinuitySeverity | undefined;

    const addIssue = (severity: ContinuitySeverity, description: string, rule_violated?: string) => {
      issues.push({ severity, description, rule_violated });
      if (severity === 'critical') {
        maxSeverity = 'critical';
      } else if (severity === 'major' && maxSeverity !== 'critical') {
        maxSeverity = 'major';
      } else if (!maxSeverity) {
        maxSeverity = 'minor';
      }
    };

    // 1. Check risks from chapter draft
    if (draft.continuity_risks && draft.continuity_risks.length > 0) {
      for (const risk of draft.continuity_risks) {
        addIssue('minor', risk, 'Chapter draft identified continuity risk');
      }
    }

    // 2. Check plot thread invalid advancement
    for (const delta of memory.plot_thread_deltas) {
      const existing = snapshot.plot_threads.find(p => p.title === delta.thread_title);
      if (existing && existing.status === 'resolved' && delta.status && delta.status !== 'resolved') {
        addIssue('major', `Plot thread '${delta.thread_title}' was advanced/reopened but it was already resolved.`, 'Resolved plot threads should not be reopened without explicit intent.');
      }
    }

    // 3. Check items used after destroyed
    for (const delta of memory.item_deltas) {
      const existing = snapshot.items.find(i => i.name === delta.item_name);
      if (existing && (existing.state.toLowerCase().includes('destroyed') || existing.state.toLowerCase().includes('lost'))) {
        addIssue('critical', `Item '${delta.item_name}' was modified but it is currently ${existing.state}.`, 'Cannot interact with destroyed or lost items.');
      }
    }

    // 4. Check dead character interaction
    for (const delta of memory.character_deltas) {
      const existing = snapshot.characters.find(c => c.name === delta.character_name);
      if (existing && existing.status.toLowerCase().includes('dead')) {
        // Allow if this delta explicitly revives them
        if (!delta.status || delta.status.toLowerCase().includes('dead')) {
          addIssue('critical', `Character '${delta.character_name}' performed actions or had state changes, but is dead.`, 'Dead characters cannot act.');
        }
      }
    }

    return {
      pass: maxSeverity !== 'critical' && maxSeverity !== 'major',
      issues,
      maxSeverity
    };
  }
}
