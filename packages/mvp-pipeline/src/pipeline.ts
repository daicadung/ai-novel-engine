import { ConceptCandidate, StoryDna, ConceptEngine } from '@ai-novel-engine/concept-engine';
import { ChapterDraft, ChapterWriter, WriterConfig, WriterContext } from '@ai-novel-engine/chapter-writer';
import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { LongformPlanner, LongformPlan } from '@ai-novel-engine/longform-planner';
import { ContinuityChecker, ContinuityReport, ContinuitySnapshot, ExtractedMemory, MemoryExtractor } from '@ai-novel-engine/memory-continuity';
import { StoryBibleDraft, StoryArchitect } from '@ai-novel-engine/story-architect';

export interface MvpPipelineOptions {
  chapterCount?: number;
  language?: string;
}

export interface MvpChapterResult {
  draft: ChapterDraft;
  memory: ExtractedMemory;
  continuity: ContinuityReport;
}

export interface MvpOutlineResult {
  title: string;
  concept: ConceptCandidate;
  dna: StoryDna;
  bible: StoryBibleDraft;
  plan: LongformPlan;
}

export interface MvpNovelResult extends MvpOutlineResult {
  chapters: MvpChapterResult[];
}

export function generateMvpNovel(title: string, options: MvpPipelineOptions = {}): MvpNovelResult {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    throw new Error('Title must not be empty.');
  }

  const chapterCount = options.chapterCount ?? 3;
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error('chapterCount must be a positive integer.');
  }

  const language = options.language ?? 'Vietnamese';
  const concept = buildConcept(cleanTitle);
  const dna = buildDna(concept);
  const bible = buildBible(cleanTitle, concept, language);
  const planner = new LongformPlanner();
  const plan = planner.plan(
    { title: cleanTitle, bible },
    { targetChapters: chapterCount, targetArcs: Math.min(3, chapterCount), seed: cleanTitle }
  );
  const checker = new ContinuityChecker();
  const chapters: MvpChapterResult[] = [];
  const summaries: string[] = [];
  const snapshot = buildInitialSnapshot(bible);

  for (const outline of plan.chapter_outlines) {
    const context = buildWriterContext(outline, summaries, bible, plan, language);
    const draft = writeDeterministicChapter(cleanTitle, context);
    const memory = extractDeterministicMemory(draft, outline.chapter_number, bible);
    const continuity = checker.check(draft, memory, snapshot);
    chapters.push({ draft, memory, continuity });
    summaries.push(draft.summary);
    applyMemory(snapshot, memory);
  }

  return { title: cleanTitle, concept, dna, bible, plan, chapters };
}

export async function generateMvpOutlineWithGateway(
  title: string,
  gateway: LlmGateway,
  writerConfig: WriterConfig,
  options: MvpPipelineOptions = {}
): Promise<MvpOutlineResult> {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    throw new Error('Title must not be empty.');
  }

  const chapterCount = options.chapterCount ?? 3;
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error('chapterCount must be a positive integer.');
  }

  const language = options.language ?? 'Vietnamese';
  const timeoutMs = writerConfig.timeoutMs ?? 85000;
  
  // 1. Concept Engine
  const conceptEngine = new ConceptEngine(gateway, {
    provider: writerConfig.provider,
    model: writerConfig.model,
    temperature: writerConfig.temperature,
    timeoutMs,
  });
  const conceptResult = await conceptEngine.generateConcepts(cleanTitle);
  const concept = conceptResult.candidates[0];
  if (!concept) throw new Error('Failed to generate concept');
  const dna = await conceptEngine.extractStoryDna(concept);

  // 2. Story Architect
  const architect = new StoryArchitect(gateway, {
    provider: writerConfig.provider,
    model: writerConfig.model,
    temperature: writerConfig.temperature,
    timeoutMs,
  });
  const bibleResult = await architect.generateStoryBible({
    title: cleanTitle,
    concept,
    dna,
    language,
  });
  const bible = bibleResult.draft;

  // 3. Longform Planner
  const planner = new LongformPlanner();
  const plan = planner.plan(
    { title: cleanTitle, bible },
    { targetChapters: chapterCount, targetArcs: Math.min(3, chapterCount), seed: cleanTitle }
  );

  return { title: cleanTitle, concept, dna, bible, plan };
}

export async function generateChaptersForOutline(
  outline: MvpOutlineResult,
  gateway: LlmGateway,
  writerConfig: WriterConfig,
  options: MvpPipelineOptions = {}
): Promise<MvpNovelResult> {
  const language = options.language ?? 'Vietnamese';
  
  // 4. Chapter Writer & Memory Extractor
  const writer = new ChapterWriter(gateway);
  const extractor = new MemoryExtractor(gateway);
  const checker = new ContinuityChecker();
  
  const chapters: MvpChapterResult[] = [];
  const summaries: string[] = [];
  const snapshot = buildInitialSnapshot(outline.bible);

  for (const target_outline of outline.plan.chapter_outlines) {
    const context = buildWriterContext(target_outline, summaries, outline.bible, outline.plan, language);
    const draft = await writer.write(context, writerConfig);
    const memory = await extractor.extract(draft, target_outline.chapter_number, {
      provider: writerConfig.provider,
      model: writerConfig.model,
      temperature: 0.2,
      maxTokens: 800,
    });
    const continuity = checker.check(draft, memory, snapshot);
    chapters.push({ draft, memory, continuity });
    summaries.push(draft.summary);
    applyMemory(snapshot, memory);
  }

  return { ...outline, chapters };
}

export async function generateMvpNovelWithGateway(
  title: string,
  gateway: LlmGateway,
  writerConfig: WriterConfig,
  options: MvpPipelineOptions = {}
): Promise<MvpNovelResult> {
  const outline = await generateMvpOutlineWithGateway(title, gateway, writerConfig, options);
  return generateChaptersForOutline(outline, gateway, writerConfig, options);
}

function buildWriterContext(
  outline: LongformPlan['chapter_outlines'][number],
  summaries: string[],
  bible: StoryBibleDraft,
  plan: LongformPlan,
  language: string
): WriterContext {
  return {
    target_outline: outline,
    previous_summaries: summaries.slice(-3),
    relevant_characters: bible.characters,
    relevant_locations: bible.locations,
    active_plot_threads: plan.plot_threads.filter(thread => thread.status !== 'resolved'),
    recent_story_events: plan.story_events.slice(-5),
    style_guide: {
      language,
      tone: bible.bible.tone,
      pov: 'ngôi thứ ba giới hạn',
      tense: 'quá khứ',
      prose_density: 'vừa',
      dialogue_ratio: 'cân bằng',
      taboo_phrases: [],
      required_rules: ['giữ đúng luật thế giới đã lập', 'đẩy ít nhất một tuyến truyện tiến lên']
    },
    world_rules: bible.world.rules,
    continuity_notes: 'Chỉ dùng nhân vật, địa điểm, vật phẩm đã thiết lập.'
  };
}

function buildConcept(title: string): ConceptCandidate {
  return {
    title: `${title}: Khởi Nguyên Tan Vỡ`,
    premise: `${title} kể về một thiếu niên bị tước vị, từng bước khôi phục sức mạnh bằng di sản cấm.`,
    genre: 'xianxia',
    setting: 'đế quốc tu luyện chia rạn',
    protagonist_archetype: 'thiên tài sa cơ',
    theme: 'tìm lại bản ngã qua sức mạnh tự giành lấy',
    conflict: 'tranh quyền tông môn và món nợ cổ xưa',
    progression_model: 'từ yếu đến mạnh',
    power_system: 'kiếm tu',
    narrative_structure: 'trường thiên tiến cấp',
    ending_direction: 'đăng đỉnh nhưng phải trả giá'
  };
}

function buildDna(concept: ConceptCandidate): StoryDna {
  return {
    concept_dna: { premise: concept.premise, genre: concept.genre },
    world_dna: { setting: concept.setting },
    character_dna: { archetype: concept.protagonist_archetype },
    power_system_dna: { model: concept.power_system },
    faction_dna: { conflict: concept.conflict },
    plot_dna: { progression: concept.progression_model },
    arc_dna: { structure: concept.narrative_structure },
    event_dna: { opening: 'lưu đày' },
    ending_dna: { direction: concept.ending_direction }
  };
}

function buildBible(title: string, concept: ConceptCandidate, language: string): StoryBibleDraft {
  return {
    bible: {
      premise: concept.premise,
      genre: concept.genre ?? 'fantasy',
      tone: 'căng thẳng, kỷ luật, có màu huyền sử',
      style_guide: { language },
      rules: { permanent_death_matters: true, cultivation_requires_cost: true }
    },
    world: {
      name: 'Cửu Mạch Đại Lục',
      description: 'Một đại lục chia rạn, nơi kiếm mạch quyết định địa vị và sinh tử.',
      rules: { sword_veins: 'sức mạnh tăng qua thử luyện, không nhờ huyết thống' },
      history: { founding_war: 'các cổ đế từng chém nát kiếm lộ đầu tiên' }
    },
    locations: [
      { name: 'Hôi Môn Tông', kind: 'tông môn', description: 'Ngoại tông khắc nghiệt canh giữ các mỏ kiếm mạch vỡ.', metadata: {} }
    ],
    factions: [
      { name: 'Hôi Môn', kind: 'tông môn', description: 'Một tông môn thực dụng, trọng kết quả hơn xuất thân.', goals: ['kiểm soát mỏ kiếm mạch'], metadata: {} }
    ],
    characters: [
      {
        name: 'Linh Kiếm',
        role: 'nhân vật chính',
        description: `Người thừa kế của ${title}, bị tước địa vị nhưng chưa mất ý chí.`,
        personality: { core: 'nhẫn nại, kiêu hãnh, quan sát sắc bén' },
        goals: ['khôi phục kiếm mạch đã mất', 'tìm sự thật sau cuộc lưu đày'],
        secrets: ['mang đế ấn chưa thức tỉnh'],
        metadata: {},
        initial_state: {
          status: 'còn sống',
          power_state: { realm: 'Phàm Kiếm Sơ Cảnh' },
          inventory: ['thiết kiếm nứt'],
          relationships: {},
          notes: 'bị lưu đày nhưng vẫn tự do hành động',
          current_location_name: 'Hôi Môn Tông'
        }
      }
    ],
    items: [
      { name: 'thiết kiếm nứt', kind: 'vũ khí', description: 'Thanh kiếm tầm thường nhưng ẩn cộng hưởng cổ xưa.', state: { condition: 'mòn cũ' }, owner_character_name: 'Linh Kiếm' }
    ],
    abilities: [
      { name: 'Đệ Nhất Mạch Thính Kiếm', kind: 'tu luyện', description: 'Cảm nhận kiếm ý mỏng trong kim loại tổn hại.', rules: ['cần tĩnh tâm'], limitations: ['mất hiệu lực khi hoảng loạn'], character_name: 'Linh Kiếm' }
    ],
    timeline: {
      name: 'Chính Tuyến',
      description: 'Từ lưu đày đến kiếm đạo chí tôn.',
      events: [{ sequence_number: 1, title: 'Lưu đày', description: 'Linh Kiếm đến Hôi Môn.', event_type: 'quá khứ', payload: {} }]
    },
    plot_threads: [
      { title: 'Khôi phục kiếm mạch đã mất', status: 'active', priority: 1, description: 'Tìm nguyên nhân nhân vật chính mất thiên phú.', metadata: {} }
    ]
  };
}

function writeDeterministicChapter(title: string, context: WriterContext): ChapterDraft {
  const character = context.relevant_characters[0];
  const location = context.relevant_locations[0];
  const thread = context.active_plot_threads[0];
  const chapterTitle = `${title} - ${context.target_outline.title}`;
  const beats = Array.isArray(context.target_outline.outline.beats)
    ? context.target_outline.outline.beats.filter((beat): beat is string => typeof beat === 'string')
    : [];
  return {
    title: chapterTitle,
    content: `${character.name} bước qua ${location.name}, giữ hơi thở thật chậm để nghe tiếng kiếm mạch dưới lớp đá cháy. Nhịp chương mở ra bằng ${beats.join(', ')}. Thanh thiết kiếm nứt khẽ rung trong tay, không tạo kỳ tích rẻ tiền, chỉ đáp lại một lần như tàn lửa còn sống. Từ dấu hiệu nhỏ ấy, ${character.name} hiểu rằng con đường khôi phục kiếm mạch không nằm ở huyết thống đã mất, mà nằm trong từng lần chịu đau, từng lần ép bản thân đứng dậy. Tuyến truyện "${thread.title}" tiến thêm một bước, còn luật của thế giới vẫn được giữ: sức mạnh phải đổi bằng thử luyện.`,
    summary: `${character.name} phát hiện kiếm ý yếu tại ${location.name} và tiến thêm trên tuyến "${thread.title}".`,
    word_count: 118,
    advanced_plot_threads: [thread.title],
    introduced_facts: [`${location.name} còn sót kiếm ý bị tổn hại.`],
    continuity_risks: []
  };
}

function extractDeterministicMemory(draft: ChapterDraft, chapterNumber: number, bible: StoryBibleDraft): ExtractedMemory {
  const character = bible.characters[0];
  const location = bible.locations[0];
  const thread = bible.plot_threads[0];
  return {
    chapter_number: chapterNumber,
    character_deltas: [{ character_name: character.name, status: 'alive', location_name: location.name, notes: draft.summary }],
    relationship_deltas: [],
    location_deltas: [{ location_name: location.name, state_changes: { last_chapter_seen: chapterNumber } }],
    item_deltas: [],
    plot_thread_deltas: [{ thread_title: thread.title, status: 'active', development_summary: draft.summary }],
    story_events: [{ title: draft.title, description: draft.summary, event_type: 'tiến triển_chương' }],
    foreshadowing: [{ description: 'Thanh thiết kiếm nứt có thể chứa một luồng kiếm ý cổ hơn.' }]
  };
}

function buildInitialSnapshot(bible: StoryBibleDraft): ContinuitySnapshot {
  return {
    characters: bible.characters.map(character => ({
      name: character.name,
      status: character.initial_state?.status ?? 'alive',
      location_name: character.initial_state?.current_location_name
    })),
    items: bible.items.map(item => ({
      name: item.name,
      state: String(item.state.condition ?? 'available'),
      owner_name: item.owner_character_name,
      location_name: item.location_name
    })),
    plot_threads: bible.plot_threads.map(thread => ({ title: thread.title, status: thread.status })),
    world_rules: Object.keys(bible.world.rules)
  };
}

function applyMemory(snapshot: ContinuitySnapshot, memory: ExtractedMemory): void {
  for (const delta of memory.character_deltas) {
    const character = snapshot.characters.find(item => item.name === delta.character_name);
    if (character) {
      character.status = delta.status ?? character.status;
      character.location_name = delta.location_name ?? character.location_name;
    }
  }
  for (const delta of memory.plot_thread_deltas) {
    const thread = snapshot.plot_threads.find(item => item.title === delta.thread_title);
    if (thread) {
      thread.status = delta.status ?? thread.status;
    }
  }
}
