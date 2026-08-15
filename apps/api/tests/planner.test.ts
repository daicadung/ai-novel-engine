import { describe, it, expect } from 'vitest';
import { ChapterRangeAllocator } from '../src/services/planner/allocator.js';

describe('ChapterRangeAllocator', () => {
  it('should evenly distribute chapters when perfectly divisible', () => {
    const ranges = ChapterRangeAllocator.allocate(300, 5);
    expect(ranges.length).toBe(5);
    expect(ranges[0]).toEqual({ start: 1, end: 60 });
    expect(ranges[1]).toEqual({ start: 61, end: 120 });
    expect(ranges[4]).toEqual({ start: 241, end: 300 });
  });

  it('should distribute remaining chapters to earlier items', () => {
    const ranges = ChapterRangeAllocator.allocate(10, 3);
    // 10 / 3 = 3 rem 1. So 4, 3, 3
    expect(ranges.length).toBe(3);
    expect(ranges[0]).toEqual({ start: 1, end: 4 });
    expect(ranges[1]).toEqual({ start: 5, end: 7 });
    expect(ranges[2]).toEqual({ start: 8, end: 10 });
  });

  it('should handle count larger than total', () => {
    const ranges = ChapterRangeAllocator.allocate(2, 3);
    // 2 / 3 = 0 rem 2. So 1, 1, 0
    expect(ranges.length).toBe(3);
    expect(ranges[0]).toEqual({ start: 1, end: 1 });
    expect(ranges[1]).toEqual({ start: 2, end: 2 });
    expect(ranges[2]).toEqual({ start: 3, end: 2 }); // Invalid range conceptually but math works
  });

  it('should return empty array for 0 count', () => {
    const ranges = ChapterRangeAllocator.allocate(100, 0);
    expect(ranges.length).toBe(0);
  });
});
