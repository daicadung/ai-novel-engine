import { describe, it, expect } from 'vitest';
import { CreateNovelSchema } from '../src/schemas/novel.schema.js';

describe('Schema Validation Tests (No DB Required)', () => {
  it('should pass valid novel data', () => {
    const validData = {
      title: 'A Valid Title',
      premise: 'A premise',
      targetChapters: 20
    };
    const result = CreateNovelSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail missing title', () => {
    const invalidData = {
      premise: 'No title'
    };
    const result = CreateNovelSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
