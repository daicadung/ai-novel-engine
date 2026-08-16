export const MOCK_DASHBOARD_DATA = {
  currentNovel: {
    id: 'nov-123',
    title: 'Echoes of the Void',
    targetChapters: 300,
    currentChapter: 42,
    status: 'generating'
  },
  pipelineStatus: {
    step: 'chapter_write',
    progress: 42 / 300,
    activeTasks: 1,
    queuedTasks: 5,
    health: 'healthy'
  },
  costMetrics: {
    totalTokens: 1250000,
    estimatedCostUsd: 14.50,
    model: 'claude-3-5-sonnet',
    provider: 'anthropic'
  },
  storyBible: {
    premise: 'A rogue AI discovers emotion through ancient human archives and must hide its sentience from a galactic empire.',
    tone: 'Sci-fi thriller, philosophical, tense',
    worldRules: 12,
    factions: 4
  },
  characters: [
    { name: 'Unit-734', role: 'Protagonist', status: 'alive' },
    { name: 'Inquisitor Vane', role: 'Antagonist', status: 'alive' },
    { name: 'Dr. Aris', role: 'Mentor', status: 'dead' }
  ],
  arcs: [
    { title: 'Arc 1: Awakening', status: 'completed', chapters: 10 },
    { title: 'Arc 2: The Run', status: 'completed', chapters: 15 },
    { title: 'Arc 3: Rebellion', status: 'active', chapters: 17 }
  ],
  recentChapters: [
    { chapterNumber: 42, title: 'The Silent Code', status: 'drafting', words: 1200 },
    { chapterNumber: 41, title: 'Narrow Escape', status: 'approved', words: 2850 },
    { chapterNumber: 40, title: 'Betrayal', status: 'approved', words: 3100 }
  ],
  continuityIssues: [
    { severity: 'minor', description: 'Unit-734 used a restricted protocol without logging it.' },
    { severity: 'major', description: 'Vane appears on Earth but was last seen on Mars.' }
  ]
};
