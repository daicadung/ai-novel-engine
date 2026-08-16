import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 8 Integration Scope Constraints', () => {
  it('does not add any new database migrations', () => {
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      const phase8Migrations = files.filter(f => f.includes('phase_8'));
      expect(phase8Migrations.length).toBe(0);
    }
  });

  it('does not contain unauthorized imports in packages/generation-orchestrator', () => {
    const pkgDir = path.join(__dirname, '../../packages/generation-orchestrator/src');
    
    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (fullPath.endsWith('.ts')) {
          results.push(fullPath);
        }
      });
      return results;
    }

    const files = scanFiles(pkgDir);
    let allContent = '';
    files.forEach(f => {
      allContent += fs.readFileSync(f, 'utf8') + '\n';
    });

    expect(allContent).not.toMatch(/\bfetch\(/);
    expect(allContent).not.toMatch(/from '@supabase\/supabase-js'/);
    expect(allContent).not.toMatch(/from 'pg'/);
    expect(allContent).not.toMatch(/from 'redis'/);
    expect(allContent).not.toMatch(/from 'ioredis'/);
    expect(allContent).not.toMatch(/setInterval\(/);
  });
});
