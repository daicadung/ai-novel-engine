# AI Novel Engine

## Phase 0
TypeScript monorepo with Next.js, Fastify, PostgreSQL/pgvector, Redis and Prisma.

### Run
```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Web: http://localhost:3000  
API: http://localhost:3001/health
