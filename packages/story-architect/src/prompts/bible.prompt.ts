import { LlmMessage } from '@ai-novel-engine/llm-gateway';
import { StoryArchitectInput } from '../types';

export function buildStoryBiblePrompt(input: StoryArchitectInput): LlmMessage[] {
  const systemPrompt = `You are an expert Story Architect. Generate a complete, internally consistent Story Bible payload in JSON.
Output ONLY valid JSON matching this exact structure:
{
  "bible": { "premise": "...", "genre": "...", "tone": "...", "style_guide": {}, "rules": {} },
  "world": { "name": "...", "description": "...", "rules": {}, "history": {} },
  "locations": [
    { "name": "...", "kind": "...", "description": "...", "metadata": {}, "parentName": "..." }
  ],
  "factions": [
    { "name": "...", "kind": "...", "description": "...", "goals": [], "metadata": {} }
  ],
  "characters": [
    { 
      "name": "...", "role": "...", "description": "...", "personality": {}, "goals": [], "secrets": [], "metadata": {},
      "initial_state": { "status": "...", "power_state": {}, "inventory": [], "relationships": {}, "notes": "...", "current_location_name": "..." }
    }
  ],
  "items": [
    { "name": "...", "kind": "...", "description": "...", "state": {}, "owner_character_name": "...", "location_name": "..." }
  ],
  "abilities": [
    { "name": "...", "kind": "...", "description": "...", "rules": [], "limitations": [], "character_name": "..." }
  ],
  "timeline": {
    "name": "...", "description": "...",
    "events": [
      { "sequence_number": 1, "title": "...", "description": "...", "event_type": "...", "payload": {} }
    ]
  },
  "plot_threads": [
    { "title": "...", "status": "open", "priority": 1, "description": "...", "metadata": {} }
  ]
}

- Plot thread status MUST be one of: "open", "active", "resolved", "dropped".
- Ensure that names used in references (e.g., location_name, owner_character_name, parentName) precisely match the names declared in other sections.
- Return ONLY the JSON object. Do not wrap in markdown or add explanations.`;

  let userContent = `Title: ${input.title}
Language: ${input.language || 'English'}
Target Chapters: ${input.targetChapterCount || 'Not specified'}

CONCEPT:
${JSON.stringify(input.concept, null, 2)}

STORY DNA:
${JSON.stringify(input.dna, null, 2)}`;

  if (input.styleNotes) {
    userContent += `\n\nSTYLE NOTES:\n${input.styleNotes}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];
}
