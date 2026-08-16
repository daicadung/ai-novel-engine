import { StyleProfile } from '../types';

export function mergeStyleProfile(base: StyleProfile, override?: Partial<StyleProfile>): StyleProfile {
  if (!override) return { ...base, taboo_phrases: [...base.taboo_phrases], required_rules: [...base.required_rules] };

  return {
    language: override.language ?? base.language,
    tone: override.tone ?? base.tone,
    pov: override.pov ?? base.pov,
    tense: override.tense ?? base.tense,
    prose_density: override.prose_density ?? base.prose_density,
    dialogue_ratio: override.dialogue_ratio ?? base.dialogue_ratio,
    taboo_phrases: override.taboo_phrases 
      ? Array.from(new Set([...base.taboo_phrases, ...override.taboo_phrases]))
      : [...base.taboo_phrases],
    required_rules: override.required_rules
      ? Array.from(new Set([...base.required_rules, ...override.required_rules]))
      : [...base.required_rules],
  };
}
