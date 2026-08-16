import { DeterministicPRNG } from '../utils/prng';
import { 
  LongformPlan, 
  LongformPlannerConfig, 
  LongformPlannerInput, 
  ArcPlan, 
  SubArcPlan, 
  ChapterOutlinePlan,
  PlotThreadPlan,
  TimelineEventPlan,
  LONGFORM_PHASES,
  LongformPhase
} from '../types';

export class LongformPlanner {
  plan(input: LongformPlannerInput, config: LongformPlannerConfig): LongformPlan {
    if (!input.title || input.title.trim() === '') {
      throw new Error('Validation Error: Title must not be empty.');
    }
    if (!input.title || input.title.trim() === '') {
      throw new Error('Validation Error: Title must not be empty.');
    }
    if (config.targetChapters <= 0) {
      throw new Error('Validation Error: targetChapters must be greater than 0.');
    }
    if (!input.bible.bible.premise || input.bible.bible.premise.trim() === '') {
      throw new Error('Validation Error: Bible premise must not be empty.');
    }
    if (!input.bible.world.name || input.bible.world.name.trim() === '' || !input.bible.world.description || input.bible.world.description.trim() === '') {
      throw new Error('Validation Error: World name and description must not be empty.');
    }
    if (!input.bible.characters || input.bible.characters.length === 0 || !input.bible.characters.some(c => c.name.trim() !== '')) {
      throw new Error('Validation Error: At least one character with a non-empty name is required.');
    }
    if (input.bible.plot_threads) {
      for (const pt of input.bible.plot_threads) {
        if (!pt.title || pt.title.trim() === '' || !pt.description || pt.description.trim() === '') {
          throw new Error('Validation Error: Plot threads must have non-empty title and description.');
        }
        if (typeof pt.priority !== 'number' || !isFinite(pt.priority)) {
          throw new Error('Validation Error: Plot thread priority must be a finite number.');
        }
      }
    }

    const prng = new DeterministicPRNG(config.seed ?? 'default-seed');

    // 1. Calculate Arcs
    const arcs: ArcPlan[] = [];
    const minChapPerArc = config.chaptersPerArcRange?.[0] ?? 25;
    const maxChapPerArc = config.chaptersPerArcRange?.[1] ?? 60;
    
    let numArcs = config.targetArcs;
    if (!numArcs) {
      // derive from target chapters
      const targetAvg = (minChapPerArc + maxChapPerArc) / 2;
      numArcs = Math.max(1, Math.round(config.targetChapters / targetAvg));
    }

    const baseChaptersPerArc = Math.floor(config.targetChapters / numArcs);
    let remainingChapters = config.targetChapters % numArcs;

    const subArcs: SubArcPlan[] = [];
    const chapters: ChapterOutlinePlan[] = [];

    const minChapPerSubArc = config.chaptersPerSubArcRange?.[0] ?? 5;
    const maxChapPerSubArc = config.chaptersPerSubArcRange?.[1] ?? 15;

    let globalChapter = 1;

    for (let i = 1; i <= numArcs; i++) {
      let arcChapCount = baseChaptersPerArc;
      if (remainingChapters > 0) {
        arcChapCount++;
        remainingChapters--;
      }

      // If we are adding randomness
      if (i < numArcs && prng.random() > 0.5 && arcChapCount > minChapPerArc) {
        arcChapCount--;
        remainingChapters++;
      } else if (i < numArcs && remainingChapters > 0 && prng.random() > 0.5 && arcChapCount < maxChapPerArc) {
        arcChapCount++;
        remainingChapters--;
      }

      // To ensure total chapters exactly matches config.targetChapters
      if (i === numArcs) {
        arcChapCount += remainingChapters;
      }

      // Determine phase based on relative position
      const arcProgress = numArcs > 1 ? (i - 1) / (numArcs - 1) : 1;
      let arcPhase: LongformPhase = LONGFORM_PHASES.SETUP;
      if (arcProgress >= 0.8) arcPhase = LONGFORM_PHASES.FALLOUT;
      else if (arcProgress >= 0.6) arcPhase = LONGFORM_PHASES.CLIMAX;
      else if (arcProgress >= 0.4) arcPhase = LONGFORM_PHASES.REVERSAL;
      else if (arcProgress >= 0.2) arcPhase = LONGFORM_PHASES.ESCALATION;

      const arcId = `arc-${i}`;
      arcs.push({
        id: arcId,
        arc_number: i,
        title: `Arc ${i}`,
        purpose: `Major story progression for Arc ${i}`,
        status: 'planned',
        summary: `Summary of Arc ${i}`,
        metadata: { phase: arcPhase }
      });

      // 2. Sub-Arcs
      const avgSubArc = (minChapPerSubArc + maxChapPerSubArc) / 2;
      const numSubArcs = Math.max(1, Math.round(arcChapCount / avgSubArc));
      
      const baseChapPerSub = Math.floor(arcChapCount / numSubArcs);
      let remSubChap = arcChapCount % numSubArcs;

      for (let j = 1; j <= numSubArcs; j++) {
        let subChapCount = baseChapPerSub;
        if (remSubChap > 0) {
          subChapCount++;
          remSubChap--;
        }

        const subArcProgress = numSubArcs > 1 ? (j - 1) / (numSubArcs - 1) : 1;
        let subArcPhase: LongformPhase = LONGFORM_PHASES.SETUP;
        if (subArcProgress >= 0.8) subArcPhase = LONGFORM_PHASES.FALLOUT;
        else if (subArcProgress >= 0.6) subArcPhase = LONGFORM_PHASES.CLIMAX;
        else if (subArcProgress >= 0.4) subArcPhase = LONGFORM_PHASES.REVERSAL;
        else if (subArcProgress >= 0.2) subArcPhase = LONGFORM_PHASES.ESCALATION;

        const subArcId = `${arcId}-sub-${j}`;
        subArcs.push({
          id: subArcId,
          arc_id: arcId,
          sub_arc_number: j,
          title: `Mạch truyện ${i}.${j}`,
          purpose: `Đẩy nhịp trưởng thành ${j}`,
          status: 'planned',
          summary: `Tóm tắt mạch truyện ${i}.${j}`,
          metadata: { phase: subArcPhase }
        });

        // 3. Chapters
        for (let k = 1; k <= subChapCount; k++) {
          const chapProgress = subChapCount > 1 ? (k - 1) / (subChapCount - 1) : 1;
          let chapPhase: LongformPhase = LONGFORM_PHASES.SETUP;
          if (chapProgress >= 0.8) chapPhase = LONGFORM_PHASES.FALLOUT;
          else if (chapProgress >= 0.6) chapPhase = LONGFORM_PHASES.CLIMAX;
          else if (chapProgress >= 0.4) chapPhase = LONGFORM_PHASES.REVERSAL;
          else if (chapProgress >= 0.2) chapPhase = LONGFORM_PHASES.ESCALATION;

          chapters.push({
            id: `chapter-${globalChapter}`,
            arc_id: arcId,
            sub_arc_id: subArcId,
            chapter_number: globalChapter,
            title: `Chương ${globalChapter}`,
            purpose: `Đẩy tuyến truyện chính tiến lên`,
            outline: { beats: [`Nhịp chính: ${chapPhase}`] },
            status: 'planned'
          });
          globalChapter++;
        }
      }
    }

    // 4. Plot Threads
    const plotThreads: PlotThreadPlan[] = (input.bible.plot_threads || []).map((pt, idx) => ({
      id: `pt-${idx}`,
      title: pt.title,
      status: pt.status,
      priority: pt.priority,
      description: pt.description,
      metadata: { ...pt.metadata, planned_resolution_chapter: prng.randomInt(1, config.targetChapters) }
    }));

    // 5. Timelines
    const timelineId = 'timeline-1';
    const timelines = [{
      id: timelineId,
      name: input.bible.timeline?.name || 'Main Timeline',
      description: input.bible.timeline?.description || 'Auto-generated master timeline',
    }];

    const story_events: TimelineEventPlan[] = [];
    if (input.bible.timeline?.events) {
      input.bible.timeline.events.forEach((ev, idx) => {
        story_events.push({
          id: `ev-${idx}`,
          timeline_id: timelineId,
          sequence_number: ev.sequence_number,
          chapter_number: prng.randomInt(1, config.targetChapters),
          title: ev.title,
          description: ev.description,
          event_type: ev.event_type,
          payload: ev.payload
        });
      });
    }

    return {
      arcs,
      sub_arcs: subArcs,
      chapter_outlines: chapters,
      plot_threads: plotThreads,
      timelines,
      story_events
    };
  }
}
