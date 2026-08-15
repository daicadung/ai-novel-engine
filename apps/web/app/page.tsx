"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Novel = { id: string; title: string; premise: string; status: string };

export default function Home() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3001/api/novels")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNovels(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    
    if (!title) return;
    
    try {
      const res = await fetch("http://localhost:3001/api/novels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, premise: "A new story..." })
      });
      if (res.ok) {
        const novel = await res.json();
        setNovels([novel, ...novels]);
        (e.target as HTMLFormElement).reset();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 48, fontFamily: "sans-serif" }}>
      <h1>AI Novel Engine Dashboard</h1>
      <section style={{ marginBottom: 40 }}>
        <h2>Create Novel</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input name="title" placeholder="Novel Title" required style={{ padding: 8 }} />
          <button type="submit" style={{ padding: "8px 16px" }}>Create</button>
        </form>
      </section>

      <section>
        <h2>Your Novels</h2>
        {loading ? <p>Loading...</p> : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {novels.length === 0 ? <p>No novels found.</p> : novels.map(novel => (
              <div key={novel.id} style={{ border: "1px solid #ccc", padding: 16, borderRadius: 8, width: 300 }}>
                <h3>{novel.title}</h3>
                <p style={{ fontSize: 14, color: "#666" }}>{novel.premise}</p>
                <Link href={'/novel/' + novel.id} style={{ color: "blue", textDecoration: "underline" }}>Open Novel</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
