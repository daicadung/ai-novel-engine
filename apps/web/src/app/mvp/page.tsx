import { generateMvpNovel, mapMvpNovelToPersistence, buildMvpInsertPlan } from '@ai-novel-engine/mvp-pipeline';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOfParam(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function numberParam(value: string | string[] | undefined, fallback: number): number {
  const raw = valueOfParam(value, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

export default async function MvpPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const title = valueOfParam(params.title, 'Ta La Kiem De').trim() || 'Ta La Kiem De';
  const chapterCount = numberParam(params.chapters, 50);
  const error = valueOfParam(params.error, '');
  const result = generateMvpNovel(title, { chapterCount });
  const payloads = mapMvpNovelToPersistence(result, {
    ownerId: '00000000-0000-4000-8000-000000000001',
    novelId: '00000000-0000-4000-8000-000000000002'
  });
  const insertPlan = buildMvpInsertPlan(payloads);
  const passedChecks = result.chapters.filter(chapter => chapter.continuity.pass).length;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">MVP Generator</p>
            <h1 className="text-2xl font-semibold tracking-tight">Title to checked chapters</h1>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row" action="/mvp">
            <input
              aria-label="Novel title"
              className="h-10 w-full min-w-0 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500 sm:w-80"
              name="title"
              defaultValue={title}
            />
            <input
              aria-label="Chapter count"
              className="h-10 w-28 border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-blue-500"
              name="chapters"
              type="number"
              min="1"
              max="100"
              defaultValue={chapterCount}
            />
            <button className="h-10 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" type="submit">
              Generate
            </button>
          </form>
          <form className="flex flex-col gap-2 sm:flex-row" action="/api/mvp/save" method="post">
            <input name="title" type="hidden" value={title} />
            <input name="chapters" type="hidden" value={chapterCount} />
            <button className="h-10 bg-green-700 px-4 text-sm font-medium text-white hover:bg-green-800" type="submit">
              Save to Supabase
            </button>
          </form>
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Concept</p>
            <p className="mt-2 text-sm font-medium">{result.concept.title}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Chapters</p>
            <p className="mt-2 text-2xl font-semibold">{result.chapters.length}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Continuity</p>
            <p className="mt-2 text-2xl font-semibold">{passedChecks}/{result.chapters.length}</p>
          </div>
          <div className="border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">SQL statements</p>
            <p className="mt-2 text-2xl font-semibold">{insertPlan.statements.length}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Story Bible</h2>
            <p className="mt-3 text-sm text-zinc-700">{result.bible.bible.premise}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">World</dt>
                <dd className="font-medium">{result.bible.world.name}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Protagonist</dt>
                <dd className="font-medium">{result.bible.characters[0]?.name}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase text-zinc-500">Persistence Payload</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <span>concept_candidates</span><strong>{payloads.concept_candidates.length}</strong>
              <span>story_dna</span><strong>{payloads.story_dna.length}</strong>
              <span>chapter_outlines</span><strong>{payloads.chapter_outlines.length}</strong>
              <span>chapters</span><strong>{payloads.chapters.length}</strong>
              <span>story_events</span><strong>{payloads.story_events.length}</strong>
            </div>
          </div>
        </section>

        <section className="border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase text-zinc-500">Recent Generated Chapters</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Chapter</th>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Memory</th>
                  <th className="py-2 pr-4 font-medium">Continuity</th>
                </tr>
              </thead>
              <tbody>
                {result.chapters.slice(-10).map(chapter => (
                  <tr className="border-b border-zinc-100" key={chapter.memory.chapter_number}>
                    <td className="py-3 pr-4 text-zinc-500">{chapter.memory.chapter_number}</td>
                    <td className="py-3 pr-4 font-medium">{chapter.draft.title}</td>
                    <td className="py-3 pr-4">{chapter.memory.story_events.length} event</td>
                    <td className="py-3 pr-4">{chapter.continuity.pass ? 'pass' : 'fail'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
