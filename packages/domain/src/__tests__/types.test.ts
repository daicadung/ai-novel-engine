import { describe, it, expect } from 'vitest'
import { NOVEL_STATUSES, CHAPTER_STATUSES, Novel, NovelStatus } from '../index'

describe('Domain Types Smoke Test', () => {
  it('validates exported status arrays', () => {
    expect(NOVEL_STATUSES).toContain('draft')
    expect(NOVEL_STATUSES.length).toBe(6)

    expect(CHAPTER_STATUSES).toContain('published')
    expect(CHAPTER_STATUSES.length).toBe(5)
  })

  it('validates a typed fixture', () => {
    const novelStatus: NovelStatus = NOVEL_STATUSES[0];
    const novel: Novel = {
      id: '123',
      owner_id: '456',
      title: 'Test Novel',
      status: novelStatus,
      language: 'vi',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(novel.title).toBe('Test Novel')
  })
})
