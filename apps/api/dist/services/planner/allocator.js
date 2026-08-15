export class ChapterRangeAllocator {
    static allocate(total, count) {
        if (count <= 0)
            return [];
        const base = Math.floor(total / count);
        const extra = total % count;
        const ranges = [];
        let current = 1;
        for (let i = 0; i < count; i++) {
            // distribute extra evenly to the first 'extra' items
            const size = base + (i < extra ? 1 : 0);
            ranges.push({ start: current, end: current + size - 1 });
            current += size;
        }
        return ranges;
    }
}
