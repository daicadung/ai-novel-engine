import { describe, it, expect } from 'vitest';
import { parseMemoryOutput } from '../parsers/memory.parser';

describe('Memory Parser', () => {
  it('parses valid json payload successfully', () => {
    const validJson = JSON.stringify({
      chapter_number: 1,
      character_deltas: [],
      relationship_deltas: [],
      location_deltas: [],
      item_deltas: [],
      plot_thread_deltas: [],
      story_events: [],
      foreshadowing: []
    });

    const parsed = parseMemoryOutput(validJson);
    expect(parsed.chapter_number).toBe(1);
    expect(parsed.character_deltas).toEqual([]);
  });

  it('rejects markdown blocks', () => {
    const validObj = {
      chapter_number: 2,
      character_deltas: [],
      relationship_deltas: [],
      location_deltas: [],
      item_deltas: [],
      plot_thread_deltas: [],
      story_events: [],
      foreshadowing: []
    };
    const markdownJson = '\`\`\`json\n' + JSON.stringify(validObj) + '\n\`\`\`';
    expect(() => parseMemoryOutput(markdownJson)).toThrow(/markdown code blocks/i);
  });

  it('throws error for plain text prose', () => {
    const prose = 'Chapter 1 memory extraction:\n\nNo changes.';
    expect(() => parseMemoryOutput(prose)).toThrow(/JSON/i);
  });

  it('throws error for missing required fields', () => {
    const invalidJson = JSON.stringify({
      chapter_number: 1,
      // missing arrays
    });

    expect(() => parseMemoryOutput(invalidJson)).toThrow(/must be an array/i);
  });

  it('throws error for invalid chapter_number', () => {
    const invalidJson = JSON.stringify({
      chapter_number: 'one',
      character_deltas: [],
      relationship_deltas: [],
      location_deltas: [],
      item_deltas: [],
      plot_thread_deltas: [],
      story_events: [],
      foreshadowing: []
    });

    expect(() => parseMemoryOutput(invalidJson)).toThrow(/invalid chapter_number/i);
  });
});
