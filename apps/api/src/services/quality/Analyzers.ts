import {
  QualityIssue,
  QualityIssueType,
  QualityIssueSeverity,
  ChapterMemory,
  PlotThreadState,
  StateDelta,
  EntityTypeEnum,
} from '@ane/core';
import { QualityScoringEngine } from './QualityScoringEngine.js';

// Thresholds (env-configurable)
const MIN_EVENTS = parseFloat(process.env.QUALITY_MIN_EVENTS_PER_CHAPTER ?? '2');
const MAX_EVENTS = parseFloat(process.env.QUALITY_MAX_EVENTS_PER_CHAPTER ?? '15');
const MIN_WORD_COUNT = parseInt(process.env.QUALITY_MIN_WORD_COUNT ?? '1000', 10);
const MAX_WORD_COUNT = parseInt(process.env.QUALITY_MAX_WORD_COUNT ?? '8000', 10);
const MAX_OPEN_THREADS = parseInt(process.env.QUALITY_MAX_OPEN_THREADS ?? '8', 10);
const UNRESOLVED_THREAD_LIMIT = parseInt(process.env.QUALITY_UNRESOLVED_LIMIT ?? '5', 10);
const MIN_STATE_CHANGES = parseInt(process.env.QUALITY_MIN_STATE_CHANGES ?? '1', 10);

/**
 * PacingAnalyzer — deterministic pacing analysis. Pure, no DB, no LLM.
 */
export class PacingAnalyzer {
  static analyze(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      memory?: ChapterMemory;
      wordCount?: number;
      sceneCount?: number;
      stateDeltas?: StateDelta[];
      activeThreads?: PlotThreadState[];
      previousMemories?: ChapterMemory[];
    } = {}
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const { memory, wordCount = 0, sceneCount = 0, stateDeltas = [], activeThreads = [] } = options;

    const eventCount = memory?.keyEvents?.length ?? 0;
    const stateChangeCount = stateDeltas.length;

    // ---- Too slow: too few events, too many words ----
    if (eventCount < MIN_EVENTS && wordCount > MIN_WORD_COUNT) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, QualityIssueType.PACING_TOO_SLOW),
        issueType: QualityIssueType.PACING_TOO_SLOW,
        severity: QualityIssueSeverity.MEDIUM,
        confidence: 0.85,
        chapterId,
        chapterNumber,
        evidence: [
          `Only ${eventCount} key events (threshold: ${MIN_EVENTS})`,
          `Word count ${wordCount} is high relative to event count`,
        ],
        affectedEntities: [chapterId],
        suggestedRepairStrategy: 'COMPRESS_SECTION',
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'PacingAnalyzer',
        detectedAt: new Date(),
      });
    }

    // ---- Too fast: too many events, few words ----
    if (eventCount > MAX_EVENTS && wordCount < MAX_WORD_COUNT * 0.5) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, QualityIssueType.PACING_TOO_FAST),
        issueType: QualityIssueType.PACING_TOO_FAST,
        severity: QualityIssueSeverity.MEDIUM,
        confidence: 0.8,
        chapterId,
        chapterNumber,
        evidence: [
          `${eventCount} key events crammed into ${wordCount} words (threshold: ${MAX_EVENTS})`,
        ],
        affectedEntities: [chapterId],
        suggestedRepairStrategy: 'REWRITE_SCENE',
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'PacingAnalyzer',
        detectedAt: new Date(),
      });
    }

    // ---- Thread overload ----
    if (activeThreads.length > MAX_OPEN_THREADS) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, QualityIssueType.THREAD_OVERLOAD),
        issueType: QualityIssueType.THREAD_OVERLOAD,
        severity: QualityIssueSeverity.MEDIUM,
        confidence: 0.9,
        chapterId,
        chapterNumber,
        evidence: [
          `${activeThreads.length} active threads (max: ${MAX_OPEN_THREADS})`,
          `Active: ${activeThreads.slice(0, 5).map((t) => t.title).join(', ')}`,
        ],
        affectedEntities: activeThreads.slice(0, 5).map((t) => t.id),
        suggestedRepairStrategy: 'INCORPORATE_THREAD',
        isAutomaticallyRepairable: false,
        requiresLLM: false,
        detectedBy: 'PacingAnalyzer',
        detectedAt: new Date(),
      });
    }

    // ---- Excessive unresolved threads ----
    const unresolvedCount = memory?.unresolvedThreads?.length ?? 0;
    if (unresolvedCount > UNRESOLVED_THREAD_LIMIT) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, QualityIssueType.THREAD_NEGLECT, 'unresolved'),
        issueType: QualityIssueType.THREAD_NEGLECT,
        severity: QualityIssueSeverity.LOW,
        confidence: 0.75,
        chapterId,
        chapterNumber,
        evidence: [
          `${unresolvedCount} unresolved threads (limit: ${UNRESOLVED_THREAD_LIMIT})`,
        ],
        affectedEntities: memory?.unresolvedThreads?.slice(0, 5) ?? [],
        suggestedRepairStrategy: 'INCORPORATE_THREAD',
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'PacingAnalyzer',
        detectedAt: new Date(),
      });
    }

    // ---- Filler: meaningful state changes too low ----
    if (stateChangeCount < MIN_STATE_CHANGES && wordCount > MIN_WORD_COUNT) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(novelId, chapterNumber, QualityIssueType.LOW_STAKES),
        issueType: QualityIssueType.LOW_STAKES,
        severity: QualityIssueSeverity.MEDIUM,
        confidence: 0.7,
        chapterId,
        chapterNumber,
        evidence: [
          `Only ${stateChangeCount} meaningful state changes in ${wordCount} words`,
          `Nothing significant changed in this chapter`,
        ],
        affectedEntities: [chapterId],
        suggestedRepairStrategy: 'INJECT_PROGRESSION',
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'PacingAnalyzer',
        detectedAt: new Date(),
      });
    }

    return issues;
  }
}

/**
 * CharacterProgressAnalyzer — pure, deterministic. No DB, no LLM.
 */
export class CharacterProgressAnalyzer {
  static analyze(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      memory?: ChapterMemory;
      previousMemories?: ChapterMemory[];
      stateDeltas?: StateDelta[];
      characterWindowChapters?: number;
    } = {}
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const {
      memory,
      previousMemories = [],
      stateDeltas = [],
      characterWindowChapters = 10,
    } = options;

    // ---- Stagnation: character hasn't changed in N chapters ----
    const characterDeltas = stateDeltas.filter(
      (d) => d.entityType === EntityTypeEnum.CHARACTER
    );
    const recentCharacterChanges = previousMemories
      .slice(-characterWindowChapters)
      .flatMap((m) =>
        m.stateDeltas.filter((d) => d.entityType === EntityTypeEnum.CHARACTER)
      );

    if (characterDeltas.length === 0 && recentCharacterChanges.length === 0) {
      issues.push({
        id: QualityScoringEngine.buildIssueId(
          novelId,
          chapterNumber,
          QualityIssueType.CHARACTER_STAGNATION
        ),
        issueType: QualityIssueType.CHARACTER_STAGNATION,
        severity: QualityIssueSeverity.HIGH,
        confidence: 0.8,
        chapterId,
        chapterNumber,
        evidence: [
          `No character state changes in the last ${characterWindowChapters} chapters`,
          `No character development detected in current chapter`,
        ],
        affectedEntities: [],
        suggestedRepairStrategy: 'INJECT_PROGRESSION',
        isAutomaticallyRepairable: false,
        requiresLLM: true,
        detectedBy: 'CharacterProgressAnalyzer',
        detectedAt: new Date(),
      });
    }

    // ---- Character behavior drift: extreme swings without setup ----
    const relationshipChanges = memory?.changedRelationships?.length ?? 0;
    const totalCharChanges = characterDeltas.length;

    if (totalCharChanges > 0 && relationshipChanges === 0 && previousMemories.length > 5) {
      // Check if there's foreshadowing/setup in recent chapters
      const recentRevealCount = previousMemories
        .slice(-5)
        .flatMap((m) => m.revelations ?? []).length;

      if (recentRevealCount === 0 && totalCharChanges > 3) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.CHARACTER_BEHAVIOR_DRIFT
          ),
          issueType: QualityIssueType.CHARACTER_BEHAVIOR_DRIFT,
          severity: QualityIssueSeverity.MEDIUM,
          confidence: 0.65,
          chapterId,
          chapterNumber,
          evidence: [
            `${totalCharChanges} character state changes with no prior revelations/foreshadowing`,
            `Possible unmotivated behavior change`,
          ],
          affectedEntities: characterDeltas
            .map((d) => d.entityId)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 5),
          suggestedRepairStrategy: 'INJECT_PROGRESSION',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'CharacterProgressAnalyzer',
          detectedAt: new Date(),
        });
      }
    }

    return issues;
  }
}

/**
 * PlotProgressAnalyzer — pure, deterministic. No DB, no LLM.
 */
export class PlotProgressAnalyzer {
  static analyze(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      memory?: ChapterMemory;
      previousMemories?: ChapterMemory[];
      activeThreads?: PlotThreadState[];
      stateDeltas?: StateDelta[];
      targetChapters?: number;
    } = {}
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const {
      memory,
      previousMemories = [],
      activeThreads = [],
      stateDeltas = [],
      targetChapters = 100,
    } = options;

    // ---- Plot stagnation: no resolutions, no revelations, no state changes ----
    const resolvedCount = memory?.resolvedThreads?.length ?? 0;
    const revelationCount = memory?.revelations?.length ?? 0;
    const plotDeltas = stateDeltas.filter(
      (d) =>
        d.entityType === EntityTypeEnum.PLOT_THREAD ||
        d.entityType === EntityTypeEnum.WORLD_FACT
    ).length;

    if (resolvedCount === 0 && revelationCount === 0 && plotDeltas === 0) {
      // Check recent window also stagnant
      const recentStagnation = previousMemories.slice(-5).every(
        (m) =>
          (m.resolvedThreads?.length ?? 0) === 0 &&
          (m.revelations?.length ?? 0) === 0
      );

      if (recentStagnation && previousMemories.length >= 5) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.PLOT_STAGNATION
          ),
          issueType: QualityIssueType.PLOT_STAGNATION,
          severity: QualityIssueSeverity.HIGH,
          confidence: 0.85,
          chapterId,
          chapterNumber,
          evidence: [
            `No plot progression for the last 5+ chapters`,
            `0 resolved threads, 0 revelations in current chapter`,
          ],
          affectedEntities: activeThreads.slice(0, 5).map((t) => t.id),
          suggestedRepairStrategy: 'INCORPORATE_THREAD',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'PlotProgressAnalyzer',
          detectedAt: new Date(),
        });
      }
    }

    // ---- Thread neglect: high-priority thread not mentioned ----
    const highPriorityThreads = activeThreads.filter(
      (t) => t.priority >= 7 && t.introducedChapter !== undefined
    );

    for (const thread of highPriorityThreads) {
      const chaptersIgnored = chapterNumber - (thread.lastReferencedChapter ?? thread.introducedChapter ?? chapterNumber);
      if (chaptersIgnored > QualityScoringEngine.THREAD_NEGLECT_CHAPTERS) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.THREAD_NEGLECT,
            thread.id
          ),
          issueType: QualityIssueType.THREAD_NEGLECT,
          severity: QualityIssueSeverity.HIGH,
          confidence: 0.9,
          chapterId,
          chapterNumber,
          evidence: [
            `High-priority thread "${thread.title}" (priority ${thread.priority}) neglected for ${chaptersIgnored} chapters`,
          ],
          affectedEntities: [thread.id],
          suggestedRepairStrategy: 'INCORPORATE_THREAD',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'PlotProgressAnalyzer',
          detectedAt: new Date(),
        });
      }
    }

    // ---- Conflict escalation failure ----
    const progressPct = targetChapters > 0 ? chapterNumber / targetChapters : 0;
    const isLateNovel = progressPct > 0.6;

    if (isLateNovel) {
      const recentResolutions = previousMemories
        .slice(-10)
        .flatMap((m) => m.resolvedThreads ?? []).length;
      const totalActive = activeThreads.filter((t) => t.status === 'ACTIVE').length;

      if (totalActive > 5 && recentResolutions < 2) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.CONFLICT_ESCALATION_FAILURE
          ),
          issueType: QualityIssueType.CONFLICT_ESCALATION_FAILURE,
          severity: QualityIssueSeverity.HIGH,
          confidence: 0.75,
          chapterId,
          chapterNumber,
          evidence: [
            `Late novel (${Math.round(progressPct * 100)}%): ${totalActive} active conflicts but only ${recentResolutions} resolved in last 10 chapters`,
            `Escalation should be accelerating at this stage`,
          ],
          affectedEntities: activeThreads.slice(0, 5).map((t) => t.id),
          suggestedRepairStrategy: 'INCORPORATE_THREAD',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'PlotProgressAnalyzer',
          detectedAt: new Date(),
        });
      }
    }

    // ---- Unsatisfied setup: revelations referenced that were never set up ----
    if (revelationCount > 0 && previousMemories.length > 3) {
      const recentSetups = previousMemories
        .slice(-10)
        .flatMap((m) => m.keyEvents ?? []).length;

      if (recentSetups === 0) {
        issues.push({
          id: QualityScoringEngine.buildIssueId(
            novelId,
            chapterNumber,
            QualityIssueType.UNSATISFIED_SETUP
          ),
          issueType: QualityIssueType.UNSATISFIED_SETUP,
          severity: QualityIssueSeverity.MEDIUM,
          confidence: 0.6,
          chapterId,
          chapterNumber,
          evidence: [
            `${revelationCount} revelations in chapter ${chapterNumber} with no recent setup events`,
          ],
          affectedEntities: [chapterId],
          suggestedRepairStrategy: 'INJECT_PROGRESSION',
          isAutomaticallyRepairable: false,
          requiresLLM: true,
          detectedBy: 'PlotProgressAnalyzer',
          detectedAt: new Date(),
        });
      }
    }

    return issues;
  }
}
