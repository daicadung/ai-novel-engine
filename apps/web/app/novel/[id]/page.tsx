"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import GenerationJobsList from "../../../components/GenerationJobsList";
import NovelGenerationDashboard from "../../../components/NovelGenerationDashboard";

export default function NovelPage() {
  const params = useParams();
  const id = params.id as string;
  const [novel, setNovel] = useState<any>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [arcs, setArcs] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  
  useEffect(() => {
    fetch('http://localhost:3001/api/novels/' + id).then(res => res.json()).then(setNovel).catch(console.error);
    fetch('http://localhost:3001/api/characters/novel/' + id).then(res => res.json()).then(data => Array.isArray(data) && setCharacters(data)).catch(console.error);
    fetch('http://localhost:3001/api/arcs/novel/' + id).then(res => res.json()).then(data => Array.isArray(data) && setArcs(data)).catch(console.error);
    fetch('http://localhost:3001/api/chapters/novel/' + id).then(res => res.json()).then(data => Array.isArray(data) && setChapters(data)).catch(console.error);
  }, [id]);

  if (!novel) return <p style={{ padding: 48 }}>Loading...</p>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 48, fontFamily: "sans-serif" }}>
      <h1>{novel.title}</h1>
      <p>{novel.premise}</p>
      
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <button onClick={() => fetch(`http://localhost:3001/api/novels/${id}/architect/start`, { method: 'POST' })}>
          Start Story Architect
        </button>
        <p>Architect Status: <strong>{novel.architectStatus}</strong> (Stage: {novel.architectStage || 'None'})</p>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 40 }}>
        <section>
          <h2>Characters</h2>
          {characters.length === 0 ? <p>No characters yet.</p> : (
            <ul>
              {characters.map(c => <li key={c.id}><strong>{c.name}</strong> - {c.role}</li>)}
            </ul>
          )}
        </section>
        
        <section>
          <h2>Story Arcs</h2>
          {arcs.length === 0 ? <p>No arcs yet.</p> : (
            <ul>
              {arcs.map(a => <li key={a.id}>Arc {a.number}: {a.title}</li>)}
            </ul>
          )}
        </section>

        <section style={{ gridColumn: "span 2" }}>
          <h2>Chapters</h2>
          {chapters.length === 0 ? <p>No chapters yet.</p> : (
            <ul>
              {chapters.map(c => (
                <li key={c.id} style={{ marginBottom: 12 }}>
                  <strong>Chapter {c.number}: {c.title}</strong>
                  <div style={{ marginTop: 8 }}>
                    <button 
                      onClick={() => fetch(`http://localhost:3001/api/scene/${id}/chapters/${c.id}/scenes/generate`, { method: 'POST' })}
                      style={{ marginRight: 8 }}
                    >
                      Generate Scene Plan
                    </button>
                    <button 
                      onClick={() => fetch(`http://localhost:3001/api/prose/${id}/chapters/${c.id}/prose/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenePlanVersionId: 'some-id' }) })}
                    >
                      Generate Prose
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      
      <NovelGenerationDashboard novelId={id} />
      <GenerationJobsList novelId={id} />
    </main>
  );
}
