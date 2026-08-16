import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 10 Production Guardrails Constraints', () => {

  const readContent = (filePath: string) => {
    const fullPath = path.join(__dirname, '../../', filePath);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
  };

  it('asserts security headers exist in next.config.ts', () => {
    const configContent = readContent('apps/web/next.config.ts');
    
    expect(configContent).toContain('X-Content-Type-Options');
    expect(configContent).toContain('nosniff');
    expect(configContent).toContain('Referrer-Policy');
    expect(configContent).toContain('strict-origin-when-cross-origin');
    expect(configContent).toContain('X-Frame-Options');
    expect(configContent).toContain('DENY');
    expect(configContent).toContain('Permissions-Policy');
  });

  it('asserts production docs mention required operational keywords', () => {
    const checklistContent = readContent('docs/production/CHECKLIST.md');
    const runbookContent = readContent('docs/production/RUNBOOK.md');
    
    const combinedDocs = (checklistContent + runbookContent).toLowerCase();

    expect(combinedDocs).toContain('backups');
    expect(combinedDocs).toContain('rollback');
    expect(combinedDocs).toContain('migrations');
    expect(combinedDocs).toContain('rls');
    expect(combinedDocs).toContain('health');
    expect(combinedDocs).toContain('database_url');
  });

  it('asserts no accidental API keys/secrets are present in docs', () => {
    const checklistContent = readContent('docs/production/CHECKLIST.md');
    const runbookContent = readContent('docs/production/RUNBOOK.md');
    
    const combinedDocs = checklistContent + runbookContent;
    
    // Simple heuristic for generic exposed keys like "sk-..." or "ey..."
    expect(combinedDocs).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
    expect(combinedDocs).not.toMatch(/Bearer eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
  });

  it('asserts Phase 10 adds no new migrations', () => {
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir);
      const phase10Migrations = files.filter(f => f.includes('phase_10'));
      expect(phase10Migrations.length).toBe(0);
    }
  });

});
