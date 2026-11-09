"use client";

import { useParams, useRouter } from "next/navigation";
import { articles } from "@/lib/articles";
import AppNav from "@/components/AppNav";

export default function BacaArtikelPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const article = articles.find((item) => item.slug === slug);
  if (!article) return <main className="article-not-found"><h1>Artikel tidak ditemukan</h1><button className="primary" onClick={() => router.push("/artikel")}>Kembali ke Artikel</button></main>;

  return <><AppNav active="artikel"/><main className="read-article-page">
    <header className="read-article-header"><button className="back-button" onClick={() => router.push("/artikel")} aria-label="Kembali">←</button><span>Artikel</span><button className="article-brand" onClick={() => router.push("/beranda")} aria-label="Ke Beranda"><img src="/assets/fish-mascot.png" alt=""/><strong>Sehati<span>Kan</span></strong></button></header>
    <article className="article-content">
      <div className="read-article-image" style={{ backgroundImage: `url("${article.image}")`, backgroundPosition: article.position }} />
      <div className="article-content-inner"><span className="article-category-label">{article.category}</span><h1>{article.title}</h1><p className="article-date">{article.date} · 4 menit membaca</p><p className="article-lead">{article.excerpt}</p>
        {article.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <aside className="article-disclaimer">Informasi ini bersifat edukatif dan bukan pengganti diagnosis atau saran dari ahli kesehatan ikan.</aside>
        <button className="back-to-articles" onClick={() => router.push("/artikel")}>← Kembali ke daftar artikel</button>
      </div>
    </article>
  </main></>;
}
