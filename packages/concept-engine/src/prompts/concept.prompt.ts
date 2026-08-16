import { LlmMessage } from '@ai-novel-engine/llm-gateway';

export function buildConceptGenerationPrompt(title: string): LlmMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert novel architect. Given a title or brief idea, generate 3 unique, highly distinct concept candidates. 
Return ONLY valid JSON in the following format, with no markdown code blocks around it:
{
  "candidates": [
    {
      "title": "string",
      "premise": "string",
      "genre": "string",
      "setting": "string",
      "protagonist_archetype": "string",
      "theme": "string",
      "conflict": "string",
      "progression_model": "string",
      "power_system": "string",
      "narrative_structure": "string",
      "ending_direction": "string"
    }
  ]
}`
    },
    {
      role: 'user',
      content: `Generate 3 novel concepts for the title: "${title}"`
    }
  ];
}
