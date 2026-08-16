import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 7 Integration Scope Constraints', () => {
  it('does not add any new database migrations', () => {
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      const phase7Migrations = files.filter(f => f.includes('phase_7'));
      expect(phase7Migrations.length).toBe(0);
    }
  });

  it('does not contain unauthorized fetch or DB calls in packages/memory-continuity', () => {
    const pkgDir = path.join(__dirname, '../../packages/memory-continuity/src');
    
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

    expect(allContent).not.toMatch(/\bfetch\(/);
    expect(allContent).not.toMatch(/:\s*any\b|as\s+any\b|catch\s*\([^)]*:\s*any\b/);
    expect(allContent).not.toMatch(/from\s+['"]@supabase|from\s+['"]pg['"]|createClient\(|postgres(?:ql)?:\/\//i);
    expect(allContent).not.toMatch(/from\s+['"]openai['"]|from\s+['"]@anthropic-ai\/sdk['"]|from\s+['"]@google\/generative-ai['"]/i);
    expect(allContent).not.toMatch(/setInterval|while\s*\(|queue|worker|dashboard/i);
  });
});
