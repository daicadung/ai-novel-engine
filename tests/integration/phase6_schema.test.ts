import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 6 Integration Scope Constraints', () => {
  it('does not add any new database migrations', () => {
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      // Ensure no phase 6 migrations exist
      const phase6Migrations = files.filter(f => f.includes('phase_6'));
      expect(phase6Migrations.length).toBe(0);
    }
  });

  it('does not contain unauthorized fetch or SDK calls', () => {
    const pkgDir = path.join(__dirname, '../../packages/chapter-writer/src');
    
    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (fullPath.endsWith('.ts') && !fullPath.includes('__tests__')) {
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

    // We must use LlmGateway only
    expect(allContent).not.toMatch(/\bfetch\(/);
    expect(allContent).not.toMatch(/from 'openai'/);
    expect(allContent).not.toMatch(/from '@anthropic-ai\/sdk'/);
    expect(allContent).not.toMatch(/from '@google\/generative-ai'/);
    expect(allContent).not.toMatch(/:\s*any\b|as\s+any\b|catch\s*\([^)]*:\s*any\b/);
    expect(allContent).not.toMatch(/class\s+\w*Memory|function\s+\w*Memory|extractMemory/i);
    expect(allContent).not.toMatch(/class\s+\w*Continuity|function\s+\w*Continuity|checkContinuity/i);
    expect(allContent).not.toMatch(/class\s+\w*Repair|function\s+\w*Repair|repairChapter/i);
    expect(allContent).not.toMatch(/queue|worker|dashboard/i);
    expect(allContent).not.toMatch(/createClient\(|from\s+['"]@supabase|from\s+['"]pg['"]|postgres(?:ql)?:\/\//i);
  });
});
