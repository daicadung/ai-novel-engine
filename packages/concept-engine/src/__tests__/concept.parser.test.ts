import { describe, it, expect } from 'vitest';
import { parseConceptCandidates } from '../parsers/concept.parser';

describe('Concept Parser', () => {
  it('parses valid json and returns candidates', () => {
    const json = `{
      "candidates": [
        { "title": "A", "premise": "A premise" },
        { "title": "B", "premise": "B premise" }
      ]
    }`;
    const result = parseConceptCandidates(json);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].title).toBe('A');
  });

  it('strips markdown wrapping', () => {
    const json = '```json\n{\n  "candidates": [\n    { "title": "C", "premise": "C premise" }\n  ]\n}\n```';
    const result = parseConceptCandidates(json);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe('C');
  });

  it('throws on missing required fields', () => {
    const json = `{
      "candidates": [
        { "premise": "A premise" }
      ]
    }`;
    expect(() => parseConceptCandidates(json)).toThrow('missing required string field: "title"');
  });

  it('throws on invalid json', () => {
    expect(() => parseConceptCandidates('invalid')).toThrow('Failed to parse ConceptCandidates JSON');
  });
});
