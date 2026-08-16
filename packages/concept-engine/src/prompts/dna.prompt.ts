import { LlmMessage } from '@ai-novel-engine/llm-gateway';
import { ConceptCandidate } from '../types';

export function buildStoryDnaPrompt(concept: ConceptCandidate): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `You are a structural story analyst. Given a story concept, extract its fundamental Story DNA into distinct layers.
Return ONLY valid JSON in the following format, with no markdown code blocks around it:
{
  "concept_dna": { "core_identity": "string", "tone": "string" },
  "world_dna": { "rules": ["string"] },
  "character_dna": { "needs": ["string"] },
  "power_system_dna": { "limitations": ["string"] },
  "faction_dna": { "dynamics": ["string"] },
  "plot_dna": { "stakes": "string" },
  "arc_dna": { "pacing": "string" },
  "event_dna": { "inciting_incident": "string" },
  "ending_dna": { "resolution_type": "string" }
}`
    },
    {
      role: 'user',
      content: `Extract Story DNA for the following concept:\nTitle: ${concept.title}\nPremise: ${concept.premise}`
    }
  ];
}
