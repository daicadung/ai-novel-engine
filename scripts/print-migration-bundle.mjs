import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrations = [
  'supabase/migrations/20260816101952_init_schema.sql',
  'supabase/migrations/20260816183500_phase_1_core_domain.sql',
  'supabase/migrations/20260816184600_phase_2_llm_gateway.sql',
  'supabase/migrations/20260816190600_phase_3_concept_dna.sql'
];

for (const file of migrations) {
  console.log(`\n-- ===== ${file} =====\n`);
  console.log(readFileSync(join(process.cwd(), file), 'utf8'));
}
