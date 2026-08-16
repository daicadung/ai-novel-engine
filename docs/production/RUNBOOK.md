# AI Novel Engine Runbook

This operational runbook provides instructions for common development, testing, and production recovery tasks.

## Local Prerequisites
To run the project locally, ensure you have:
- **Node.js**: v18+ (v20+ recommended)
- **pnpm**: v9+ (for monorepo management)
- **Supabase CLI**: For local Postgres testing and migrations
- **Postgres/Supabase project**: Local or hosted database with migrations applied.

## Database-Backed Testing
Many integration tests will skip if a database connection is not detected. To run them properly:
1. Start or provision a Postgres database compatible with the Supabase schema.
2. Retrieve the connection string and set it in your \`.env\`:
   \`\`\`bash
   DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54322/postgres?sslmode=require&uselibpqcompat=true"
   \`\`\`
   For Supabase pooler URLs, keep `sslmode=require&uselibpqcompat=true` to avoid local Node TLS rejecting the managed certificate chain during DB-backed tests.
3. Run the DB-backed tests: \`pnpm test:db\`
4. Run the full suite: \`pnpm test\`

## Build & Release Commands
- \`pnpm project:doctor\`: Reports required project artifacts, DB readiness, and gate commands.
- \`pnpm lint\`: Checks code quality across packages.
- \`pnpm typecheck\`: Runs strict TypeScript verification.
- \`pnpm test\`: Executes unit and integration test suites.
- \`pnpm test:db\`: Executes only Postgres-backed migration, RLS, and MVP insert checks.
- \`pnpm build\`: Builds the packages and the Next.js frontend.

## Operational Recovery Procedures

### 1. Health Endpoint Fails
- **Symptom**: The health check endpoint \`/api/health\` returns 5xx or times out.
- **Action**: Check if the Node process is running out of memory. Restart the service. Verify DB connectivity if the health check probes Postgres.

### 2. Stuck Generation Job
- **Symptom**: A generation job remains in the \`running\` state indefinitely.
- **Action**: The \`GenerationOrchestrator\` has timeout boundaries, but if a job hard-locks:
  1. Inspect the last checkpoint step for the \`GenerationJob\`.
  2. Mark the active step as \`failed\` with a manual recovery flag.
  3. Resume the job using the orchestrator's \`runNext()\` method, which will retry the failed step.

### 3. Unexpected Cost Spike Response
- **Symptom**: LLM token consumption significantly exceeds estimates.
- **Action**:
  1. Pause the generation orchestrator queue immediately to prevent further billing.
  2. Inspect the \`llm-gateway\` logs to identify prompt loops or malformed retry storms.
  3. Verify the \`LLM_TIMEOUT\` configurations are still honored and connections aren't hanging.
