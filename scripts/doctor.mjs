import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const checks = [
  ['phase 1 migration', 'supabase/migrations/20260816183500_phase_1_core_domain.sql'],
  ['phase 2 migration', 'supabase/migrations/20260816184600_phase_2_llm_gateway.sql'],
  ['phase 3 migration', 'supabase/migrations/20260816190600_phase_3_concept_dna.sql'],
  ['MVP pipeline', 'packages/mvp-pipeline/src/pipeline.ts'],
  ['MVP persistence', 'packages/mvp-pipeline/src/persistence.ts'],
  ['MVP DB test', 'tests/integration/mvp_pipeline_db.test.ts'],
  ['env example', '.env.example'],
  ['production checklist', 'docs/production/CHECKLIST.md'],
  ['production runbook', 'docs/production/RUNBOOK.md']
];

const missing = checks.filter(([, file]) => !existsSync(join(root, file)));
const dbReady = Boolean(process.env.DATABASE_URL);
const envExample = existsSync(join(root, '.env.example'))
  ? readFileSync(join(root, '.env.example'), 'utf8')
  : '';

for (const [label, file] of checks) {
  console.log(`${missing.some(([, missingFile]) => missingFile === file) ? 'missing' : 'ok'} ${label}: ${file}`);
}

console.log(`${dbReady ? 'ok' : 'missing'} DATABASE_URL`);
console.log(`${envExample.includes('DATABASE_URL=') ? 'ok' : 'missing'} DATABASE_URL in .env.example`);
console.log('next gates: pnpm lint && pnpm typecheck && pnpm test && pnpm build');
console.log('db gate: pnpm test:db');

if (missing.length > 0) {
  process.exitCode = 1;
}
