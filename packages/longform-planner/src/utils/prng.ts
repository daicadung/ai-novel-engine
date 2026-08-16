export function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DeterministicPRNG {
  private prng: () => number;

  constructor(seed: number | string) {
    let seedNumber = 0;
    if (typeof seed === 'string') {
      for (let i = 0; i < seed.length; i++) {
        seedNumber = (seedNumber << 5) - seedNumber + seed.charCodeAt(i);
        seedNumber |= 0; 
      }
    } else {
      seedNumber = seed;
    }
    this.prng = mulberry32(seedNumber);
  }

  random(): number {
    return this.prng();
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}
