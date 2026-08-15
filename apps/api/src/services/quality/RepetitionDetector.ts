import { createHash } from 'node:crypto';
import {
  QualityIssue,
  QualityIssueType,
  QualityIssueSeverity,
  RepairStrategy,
  ContentFingerprint,
  ChapterMemory,
} from '@ane/core';
import { QualityScoringEngine } from './QualityScoringEngine.js';

// Configurable window to check for repetition
const REPETITION_WINDOW_CHAPTERS = parseInt(
  process.env.QUALITY_REPETITION_WINDOW ?? '20',
  10
);
const REPETITION_SIMILARITY_THRESHOLD = parseFloat(
  process.env.QUALITY_REPETITION_THRESHOLD ?? '0.85'
);

/**
 * RepetitionDetector
 *
 * Deterministic repetition detection using bounded windows and fingerprints.
 * NEVER loads the entire novel into memory.
 * NEVER calls LLMs.
 * All detection is hash/fingerprint based.
 */
export class RepetitionDetector {
  // ====================================================================
  // Build content fingerprint for a chapter
  // ====================================================================
  static buildFingerprint(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      summary?: string;
      keyEvents?: string[];
      endingHint?: string;   // first/last sentences of prose
      dialogueSamples?: string[];
      descriptionSamples?: string[];
    }
  ): ContentFingerprint[] {
    const fingerprints: ContentFingerprint[] = [];

    // SCENE fingerprint — from summary
    if (options.summary) {
      const normalized = this.normalize(options.summary);
      fingerprints.push({
        id: `${novelId}:${chapterId}:SCENE`,
        chapterId,
        chapterNumber,
        fingerprint: this.hash(normalized),
        category: 'SCENE',
        content: options.summary.slice(0, 200),
        createdAt: new Date(),
      });
    }

    // ENDING fingerprint
    if (options.endingHint) {
      const normalized = this.normalize(options.endingHint);
      fingerprints.push({
        id: `${novelId}:${chapterId}:ENDING`,
        chapterId,
        chapterNumber,
        fingerprint: this.hash(normalized),
        category: 'ENDING',
        content: options.endingHint.slice(0, 200),
        createdAt: new Date(),
      });
    }

    // DIALOGUE fingerprint — normalized from all samples
    if (options.dialogueSamples && options.dialogueSamples.length > 0) {
      const combined = options.dialogueSamples
        .map((d) => this.normalize(d))
        .join('|')
        .slice(0, 500);
      fingerprints.push({
        id: `${novelId}:${chapterId}:DIALOGUE`,
        chapterId,
        chapterNumber,
        fingerprint: this.hash(combined),
        category: 'DIALOGUE',
        content: options.dialogueSamples[0]?.slice(0, 200) ?? '',
        createdAt: new Date(),
      });
    }

    // DESCRIPTION fingerprint — merged
    if (options.descriptionSamples && options.descriptionSamples.length > 0) {
      const combined = options.descriptionSamples
        .map((d) => this.normalize(d))
        .join('|')
        .slice(0, 500);
      fingerprints.push({
        id: `${novelId}:${chapterId}:DESCRIPTION`,
        chapterId,
        chapterNumber,
        fingerprint: this.hash(combined),
        category: 'DESCRIPTION',
        content: options.descriptionSamples[0]?.slice(0, 200) ?? '',
        createdAt: new Date(),
      });
    }

    // BEAT fingerprint — from key events
    if (options.keyEvents && options.keyEvents.length > 0) {
      const beat = options.keyEvents.map((e) => this.normalize(e)).join(';').slice(0, 300);
      fingerprints.push({
        id: `${novelId}:${chapterId}:BEAT`,
        chapterId,
        chapterNumber,
        fingerprint: this.hash(beat),
        category: 'BEAT',
        content: options.keyEvents[0]?.slice(0, 200) ?? '',
        createdAt: new Date(),
      });
    }

    return fingerprints;
  }

  // ====================================================================
  // Detect repetition against a window of previous fingerprints
  // ====================================================================
  static detectRepetition(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    currentFingerprints: ContentFingerprint[],
    previousFingerprints: ContentFingerprint[],  // from previous chapters
    options: { windowChapters?: number } = {}
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const windowChapters = options.windowChapters ?? REPETITION_WINDOW_CHAPTERS;

    // Only check within the window
    const windowFps = previousFingerprints.filter(
      (fp) =>
        fp.chapterNumber >= chapterNumber - windowChapters &&
        fp.chapterNumber < chapterNumber
    );

    for (const current of currentFingerprints) {
      const matches = windowFps.filter(
        (fp) =>
          fp.category === current.category &&
          fp.fingerprint === current.fingerprint
      );

      if (matches.length === 0) continue;

      const nearestMatch = matches.reduce((a, b) =>
        Math.abs(a.chapterNumber - chapterNumber) < Math.abs(b.chapterNumber - chapterNumber)
          ? a
          : b
      );

      const issueType = this.categoryToIssueType(current.category);
      const severity =
        Math.abs(nearestMatch.chapterNumber - chapterNumber) <= 3
          ? QualityIssueSeverity.HIGH
          : QualityIssueSeverity.MEDIUM;

      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, issueType, current.category),
        issueType,
        severity,
        confidence: 1.0,  // fingerprint match is exact
        chapterId,
        chapterNumber,
        evidence: [
          `Identical ${current.category.toLowerCase()} fingerprint found in chapter ${nearestMatch.chapterNumber}`,
          `Current: "${current.content.slice(0, 100)}"`,
          `Duplicate: "${nearestMatch.content.slice(0, 100)}"`,
        ],
        affectedEntities: [chapterId, nearestMatch.chapterId],
        suggestedRepairStrategy: this.categoryToRepairStrategy(current.category),
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'RepetitionDetector',
        detectedAt: new Date(),
      });
    }

    return issues;
  }

  // ====================================================================
  // Detect repetition from chapter memories (bounded window)
  // ====================================================================
  static detectFromMemories(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    currentMemory: ChapterMemory,
    windowMemories: ChapterMemory[]  // already bounded
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (!currentMemory.summary) return issues;

    const normalizedCurrent = this.normalize(currentMemory.summary);

    for (const prev of windowMemories) {
      if (!prev.summary || prev.chapterNumber >= chapterNumber) continue;

      const normalizedPrev = this.normalize(prev.summary);
      const similarity = this.stringSimilarity(normalizedCurrent, normalizedPrev);

      if (similarity >= REPETITION_SIMILARITY_THRESHOLD) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.SCENE_REPETITION,
            prev.chapterId
          ),
          issueType: QualityIssueType.SCENE_REPETITION,
          severity: QualityIssueSeverity.MEDIUM,
          confidence: Math.round(similarity * 100) / 100,
          chapterId,
          chapterNumber,
          evidence: [
            `Chapter ${chapterNumber} summary is ${Math.round(similarity * 100)}% similar to chapter ${prev.chapterNumber}`,
            `Current: "${currentMemory.summary.slice(0, 100)}"`,
            `Previous: "${prev.summary.slice(0, 100)}"`,
          ],
          affectedEntities: [chapterId, prev.chapterId],
          suggestedRepairStrategy: 'REWRITE_SCENE',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'RepetitionDetector.fromMemories',
          detectedAt: new Date(),
        });
      }
    }

    // Detect repeated chapter endings
    if (currentMemory.keyEvents?.length) {
      const currentEvents = currentMemory.keyEvents.map((e) => this.normalize(e)).join(';');
      for (const prev of windowMemories) {
        if (!prev.keyEvents?.length) continue;
        const prevEvents = prev.keyEvents.map((e) => this.normalize(e)).join(';');
        const similarity = this.stringSimilarity(currentEvents, prevEvents);
        if (similarity >= REPETITION_SIMILARITY_THRESHOLD) {
          issues.push({
            id: QualityScoringEngine.buildIssueId(
              novelId,
              chapterNumber,
              QualityIssueType.REPETITION,
              `beat:${prev.chapterId}`
            ),
            issueType: QualityIssueType.REPETITION,
            severity: QualityIssueSeverity.MEDIUM,
            confidence: Math.round(similarity * 100) / 100,
            chapterId,
            chapterNumber,
            evidence: [
              `Chapter ${chapterNumber} beat pattern is ${Math.round(similarity * 100)}% similar to chapter ${prev.chapterNumber}`,
            ],
            affectedEntities: [chapterId, prev.chapterId],
            suggestedRepairStrategy: 'REWRITE_SCENE',
            isAutomaticallyRepairable: false,
            requiresLLM: true,
            detectedBy: 'RepetitionDetector.beatPattern',
            detectedAt: new Date(),
          });
        }
      }
    }

    return issues;
  }

  // ====================================================================
  // Compute fingerprint for repair comparison (identical candidate detection)
  // ====================================================================
  static computeProseFingerprint(proseText: string): string {
    return this.hash(this.normalize(proseText.slice(0, 2000)));
  }

  // ====================================================================
  // Private helpers
  // ====================================================================

  /** Normalize text: lowercase, remove punctuation, collapse whitespace */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static hash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 32);
  }

  /** Simple bigram-based similarity (deterministic, bounded O(n)) */
  static stringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const aBigrams = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
      const bg = a.slice(i, i + 2);
      aBigrams.set(bg, (aBigrams.get(bg) ?? 0) + 1);
    }

    let intersectionSize = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bg = b.slice(i, i + 2);
      const count = aBigrams.get(bg) ?? 0;
      if (count > 0) {
        intersectionSize++;
        aBigrams.set(bg, count - 1);
      }
    }

    return (2.0 * intersectionSize) / (a.length + b.length - 2);
  }

  private static categoryToIssueType(category: ContentFingerprint['category']): QualityIssueType {
    switch (category) {
      case 'SCENE': return QualityIssueType.SCENE_REPETITION;
      case 'DIALOGUE': return QualityIssueType.DIALOGUE_REPETITION;
      case 'DESCRIPTION': return QualityIssueType.DESCRIPTION_REPETITION;
      case 'ENDING': return QualityIssueType.CHAPTER_ENDING_WEAK;
      case 'BEAT': return QualityIssueType.REPETITION;
      default: return QualityIssueType.REPETITION;
    }
  }

  private static categoryToRepairStrategy(
    category: ContentFingerprint['category']
  ): RepairStrategy {
    switch (category) {
      case 'SCENE': return 'REWRITE_SCENE';
      case 'ENDING': return 'REGENERATE_ENDING';
      case 'DIALOGUE': return 'REWRITE_SCENE';
      case 'DESCRIPTION': return 'REWRITE_SCENE';
      case 'BEAT': return 'REWRITE_SCENE';
      default: return 'REWRITE_SCENE';
    }
  }
}
