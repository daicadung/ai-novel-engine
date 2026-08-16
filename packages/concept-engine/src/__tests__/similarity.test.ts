import { describe, it, expect } from 'vitest';
import { decideSimilarity } from '../core/similarity';

describe('Similarity Logic', () => {
  it('accepts low score', () => {
    const result = decideSimilarity(0.1);
    expect(result.decision).toBe('accept');
  });

  it('reviews moderate score', () => {
    const result = decideSimilarity(0.4);
    expect(result.decision).toBe('review');
  });

  it('rejects high score', () => {
    const result = decideSimilarity(0.8);
    expect(result.decision).toBe('reject');
  });

  it('throws on invalid score', () => {
    expect(() => decideSimilarity(-0.1)).toThrow();
    expect(() => decideSimilarity(1.1)).toThrow();
  });
});
