import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 9 Dashboard Scope Constraints', () => {
  const pagePath = path.join(__dirname, '../../apps/web/src/app/page.tsx');
  const mvpPath = path.join(__dirname, '../../apps/web/src/app/mvp/page.tsx');
  const dataPath = path.join(__dirname, '../../apps/web/src/app/dashboard-data.ts');
  const pageContent = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';
  const mvpContent = fs.existsSync(mvpPath) ? fs.readFileSync(mvpPath, 'utf8') : '';
  const dashboardContent = [
    pageContent,
    mvpContent,
    fs.existsSync(dataPath) ? fs.readFileSync(dataPath, 'utf8') : '',
  ].join('\n');

  it('no longer contains default Next.js template strings', () => {
    expect(pageContent).not.toContain('Deploy Now');
    expect(pageContent).not.toContain('To get started');
    expect(pageContent).not.toContain('Documentation');
  });

  it('includes expected domain labels in the dashboard', () => {
    expect(pageContent).toContain('Story Bible');
    expect(pageContent).toContain('Continuity');
    expect(pageContent).toContain('Arcs');
    expect(pageContent).toContain('Chapters');
    expect(pageContent).toContain('Cost');
    expect(pageContent).toContain('Generation Pipeline');
  });

  it('includes a title-only MVP generator entrypoint', () => {
    expect(mvpContent).toContain('generateMvpNovel');
    expect(mvpContent).toContain('Tên truyện');
    expect(mvpContent).toContain('Số chương');
    expect(mvpContent).toContain('Logic truyện');
    expect(mvpContent).toContain('Toàn bộ chương đã tạo');
  });

  it('does not contain unauthorized imports or network calls', () => {
    expect(dashboardContent).not.toMatch(/\bfetch\(/);
    expect(dashboardContent).not.toMatch(/from '@supabase\/supabase-js'/);
    expect(dashboardContent).not.toMatch(/from 'pg'/);
    expect(dashboardContent).not.toMatch(/process\.env/);
    expect(dashboardContent).not.toMatch(/setInterval\(/);
    expect(dashboardContent).not.toMatch(/setTimeout\(/);
  });
});
