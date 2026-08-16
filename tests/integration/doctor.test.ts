import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('project doctor', () => {
  it('reports required artifacts and DB readiness', () => {
    const output = execFileSync(process.execPath, ['scripts/doctor.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: '' }
    });

    expect(output).toContain('ok MVP pipeline');
    expect(output).toContain('ok MVP persistence');
    expect(output).toContain('missing DATABASE_URL');
    expect(output).toContain('ok DATABASE_URL in .env.example');
    expect(output).toContain('db gate: pnpm test:db');
  });
});
