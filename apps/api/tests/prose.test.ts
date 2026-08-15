import { describe, it, expect, vi } from 'vitest';
import { ProseValidator } from '../src/services/prose/validator.js';
import { ProseStageHandler } from '../src/services/prose/handlers.js';
import { MockProvider } from '../src/services/architect/llm.js';

describe('Prose Generation', () => {
  it('should validate word count', () => {
    const scenePlan = { povCharacter: 'John' };
    const report = ProseValidator.validateDraft(scenePlan, 'John went to the store.', 5);
    expect(report.passed).toBe(false);
    expect(report.failures?.[0].type).toBe('STRUCTURAL');
  });

  it('should retry on failure up to maxRetries', async () => {
    const provider = new MockProvider();
    
    // Override provider to return short prose
    vi.spyOn(provider, 'generateStructured').mockResolvedValue({
      content: 'Short content',
      wordCount: 2
    });

    const handler = new ProseStageHandler(provider);
    const scenePlan = { povCharacter: 'Character A' };
    
    const result = await handler.invokeWithRetries('Context', scenePlan, 3);
    
    expect(result.attempts).toBe(3);
    expect(result.validationReport.passed).toBe(false);
  });

  it('should pass on valid mock prose', async () => {
    const provider = new MockProvider();
    const handler = new ProseStageHandler(provider);
    const scenePlan = { povCharacter: 'Character A' };
    
    const result = await handler.invokeWithRetries('Context', scenePlan, 3);
    
    expect(result.attempts).toBe(1);
    expect(result.validationReport.passed).toBe(true);
    expect(result.wordCount).toBe(152);
  });
});
