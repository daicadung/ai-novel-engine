export const MOCK_DASHBOARD_DATA = {
  currentNovel: {
    id: 'nov-123',
    title: 'Vết Hồi Âm Hư Không',
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
    premise: 'Một trí tuệ lưu lạc tìm ra cảm xúc qua thư khố cổ nhân và phải che giấu ý thức khỏi đế quốc thiên hà.',
    tone: 'Khoa học viễn tưởng, triết lý, căng thẳng',
    worldRules: 12,
    factions: 4
  },
  characters: [
    { name: 'Đơn Vị-734', role: 'Nhân vật chính', status: 'alive' },
    { name: 'Thanh tra Vane', role: 'Phản diện', status: 'alive' },
    { name: 'Bác sĩ Aris', role: 'Người dẫn đường', status: 'dead' }
  ],
  arcs: [
    { title: 'Mạch 1: Thức tỉnh', status: 'completed', chapters: 10 },
    { title: 'Mạch 2: Cuộc chạy trốn', status: 'completed', chapters: 15 },
    { title: 'Mạch 3: Nổi dậy', status: 'active', chapters: 17 }
  ],
  recentChapters: [
    { chapterNumber: 42, title: 'Mã lặng im', status: 'drafting', words: 1200 },
    { chapterNumber: 41, title: 'Thoát hiểm trong gang tấc', status: 'approved', words: 2850 },
    { chapterNumber: 40, title: 'Phản bội', status: 'approved', words: 3100 }
  ],
  continuityIssues: [
    { severity: 'minor', description: 'Đơn Vị-734 dùng giao thức hạn chế nhưng chưa ghi log.' },
    { severity: 'major', description: 'Vane xuất hiện ở Trái Đất nhưng lần cuối được thấy trên Sao Hỏa.' }
  ]
};
