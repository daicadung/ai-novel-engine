import { WriterContext } from '../types';

export function buildWriterSystemPrompt(context: WriterContext): string {
  return `You are an expert, professional fiction writer. Your task is to write a single chapter for a novel based on the provided context.

Follow the Style Guide strictly:
- Language: ${context.style_guide.language}
- Tone: ${context.style_guide.tone}
- POV: ${context.style_guide.pov}
- Tense: ${context.style_guide.tense}
- Prose Density: ${context.style_guide.prose_density}
- Dialogue Ratio: ${context.style_guide.dialogue_ratio}
- Required Rules: ${context.style_guide.required_rules.join('; ')}
- Taboo Phrases (DO NOT USE): ${context.style_guide.taboo_phrases.join(', ')}

Output exactly and only valid JSON matching this schema:
{
  "title": "Chapter Title",
  "content": "The actual prose content of the chapter...",
  "summary": "A brief 1-2 paragraph summary of what happened.",
  "word_count": 1500,
  "advanced_plot_threads": ["List of plot threads that progressed"],
  "introduced_facts": ["List of new worldbuilding facts introduced"],
  "continuity_risks": ["List of potential continuity issues introduced"]
}

Do NOT wrap the JSON in Markdown code blocks. Do NOT output any conversational text. Return plain valid JSON.`;
}

export function buildWriterUserPrompt(context: WriterContext): string {
  return `Write Chapter ${context.target_outline.chapter_number}.

Chapter Outline:
${JSON.stringify(context.target_outline.outline, null, 2)}

Previous Summaries:
${context.previous_summaries.map((s, i) => `[Ch -${context.previous_summaries.length - i}]: ${s}`).join('\n')}

Active Characters:
${JSON.stringify(context.relevant_characters.map(c => ({ name: c.name, role: c.role, description: c.description })), null, 2)}

Locations:
${JSON.stringify(context.relevant_locations.map(l => ({ name: l.name, description: l.description })), null, 2)}

Active Plot Threads:
${JSON.stringify(context.active_plot_threads.map(pt => pt.title), null, 2)}

World Rules:
${JSON.stringify(context.world_rules, null, 2)}

Write the chapter now, focusing on strong prose and advancing the narrative according to the outline. Return only JSON.`;
}
