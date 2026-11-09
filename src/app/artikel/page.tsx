"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { articles } from "@/lib/articles";
import AppNav from "@/components/AppNav";

const categories = ["Semua", "Kesehatan ikan", "Kualitas Air", "Perawatan"] as const;

export default function ArtikelPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Semua");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => articles.filter((article) => {
    const matchesCategory = category === "Semua" || article.category === category;
    const text = `${article.title} ${article.category} ${article.excerpt}`.toLocaleLowerCase("id");
    return matchesCategory && text.includes(query.trim().toLocaleLowerCase("id"));
  }), [category, query]);
  const visible = showAll || query || category !== "Semua" ? filtered : filtered.slice(0, 3);

  return <><AppNav active="artikel"/><main className="article-page">
    <header className="article-header">
      <button className="article-brand" onClick={() => router.push("/beranda")} aria-label="Ke Beranda"><img src="/assets/fish-mascot.png" alt=""/><strong>Sehati<span>Kan</span></strong></button>
      <h1>Artikel</h1>
      <button className="article-home-link" onClick={() => router.push("/beranda")}>Beranda</button>
    </header>
    <div className="article-water" aria-hidden="true" />

    <section className="article-tools" aria-label="Cari dan filter artikel">
      <label className="article-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari Artikel..." aria-label="Cari artikel"/><button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian" hidden={!query}>×</button></label>
      <div className="category-chips" role="group" aria-label="Filter kategori">
        {categories.map((item) => <button key={item} className={`category-chip ${category === item ? "selected" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </section>

    <section className="article-results">
      <div className="article-section-heading"><h2>{query || category !== "Semua" ? "Hasil Artikel" : showAll ? "Semua Artikel" : "Artikel Populer"}</h2>
        {!query && category === "Semua" && <button onClick={() => setShowAll((value) => !value)}>{showAll ? "Tampilkan populer" : "Lihat semua"}</button>}
      </div>
      {visible.length ? <div className="article-list">{visible.map((article) => <button className="article-list-card" key={article.slug} onClick={() => router.push(`/artikel/${article.slug}`)}>
        <img src={article.image} alt="" style={{ objectPosition: article.position }}/>
        <span className="article-list-copy"><strong>{article.title}</strong><small>{article.date}</small><em>{article.category}</em></span>
      </button>)}</div> : <div className="article-empty"><span>⌕</span><strong>Artikel tidak ditemukan</strong><p>Coba kata kunci atau kategori lain.</p><button onClick={() => { setQuery(""); setCategory("Semua"); }}>Hapus filter</button></div>}
    </section>

    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button className="nav-item" onClick={() => router.push("/beranda")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg><span>Beranda</span></button>
      <button className="nav-item active" onClick={() => router.push("/artikel")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg><span>Artikel</span></button>
      <button className="nav-chat" aria-label="Konsultasi" onClick={() => router.push("/konsultasi")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.8L4 20l1.4-4A7 7 0 0 1 5 12c0-4.1 3.6-7.5 8-7.5s8 3 8 7z"/><path d="M9 12h.01M13 12h.01M17 12h.01"/></svg></button>
      <button className="nav-item" onClick={() => router.push("/riwayat")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2"/></svg><span>Riwayat</span></button>
      <button className="nav-item" onClick={() => router.push("/profil")}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Profil</span></button>
    </nav>
  </main></>;
}
