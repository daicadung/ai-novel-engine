import { describe, it, expect } from 'vitest';
import { mergeStyleProfile } from '../core/style';
import { StyleProfile } from '../types';

describe('Style Merge', () => {
  it('merges style overrides properly without mutating base', () => {
    const base: StyleProfile = {
      language: 'English',
      tone: 'Dark',
      pov: 'Third Limited',
      tense: 'Past',
      prose_density: 'High',
      dialogue_ratio: 'Low',
      taboo_phrases: ['taboo1'],
      required_rules: ['rule1']
    };

    const override = {
      tone: 'Light',
      taboo_phrases: ['taboo2'],
      required_rules: ['rule1', 'rule2'] // rule1 is duplicate
    };

    const merged = mergeStyleProfile(base, override);

    expect(merged.tone).toBe('Light');
    expect(merged.language).toBe('English'); // Unchanged
    expect(merged.taboo_phrases).toContain('taboo1');
    expect(merged.taboo_phrases).toContain('taboo2');
    expect(merged.required_rules).toEqual(['rule1', 'rule2']);

    // Original object unchanged
    expect(base.tone).toBe('Dark');
    expect(base.taboo_phrases).not.toContain('taboo2');
  });
});
