import { describe, it, expect } from 'vitest';
import { parseChapterDraft } from '../parsers/writer.parser';

describe('Writer Parser', () => {
  it('parses valid json payload successfully', () => {
    const validJson = JSON.stringify({
      title: 'A New Beginning',
      content: 'Once upon a time...',
      summary: 'They started a journey.',
      word_count: 500,
      advanced_plot_threads: ['Thread 1'],
      introduced_facts: [],
      continuity_risks: []
    });

    const parsed = parseChapterDraft(validJson);
    expect(parsed.title).toBe('A New Beginning');
    expect(parsed.content).toBe('Once upon a time...');
    expect(parsed.advanced_plot_threads).toEqual(['Thread 1']);
  });

  it('rejects markdown blocks', () => {
    const validObj = {
      title: 'A New Beginning',
      content: 'Once upon a time...',
      summary: 'They started a journey.',
      word_count: 500,
      advanced_plot_threads: [],
      introduced_facts: [],
      continuity_risks: []
    };
    const markdownJson = '\`\`\`json\n' + JSON.stringify(validObj) + '\n\`\`\`';
    expect(() => parseChapterDraft(markdownJson)).toThrow(/Markdown code blocks/);
  });

  it('throws error for plain text prose', () => {
    const prose = 'Chapter 1: A New Beginning\n\nOnce upon a time, they started a journey. It was a good journey.';

    expect(() => parseChapterDraft(prose)).toThrow(/JSON/i);
  });

  it('throws error for missing required fields', () => {
    const invalidJson = JSON.stringify({
      title: 'A New Beginning',
      content: ''
    });

    expect(() => parseChapterDraft(invalidJson)).toThrow(/Missing or empty content/i);
  });

  it('throws error for invalid word count', () => {
    const invalidJson = JSON.stringify({
      title: 'T',
      content: 'C',
      summary: 'S',
      word_count: -5
    });

    expect(() => parseChapterDraft(invalidJson)).toThrow(/Invalid or missing word_count/i);
  });
});
