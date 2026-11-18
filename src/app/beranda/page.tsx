"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { articles as sampleArticles } from "@/lib/articles";
import { getSupabase, supabaseErrorMessage } from "@/lib/supabase";

type HomeArticle = { slug:string;title:string;excerpt:string;image:string;date:string };

function Icon({ name }: { name: "home" | "book" | "chat" | "history" | "profile" | "arrow" }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20M9 7h7"/></>,
    chat: <><path d="M21 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.8L4 20l1.4-4A7 7 0 0 1 5 12c0-4.1 3.6-7.5 8-7.5s8 3 8 7z"/><path d="M9 12h.01M13 12h.01M17 12h.01"/></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    arrow: <><path d="M4 12h15M13 5l7 7-7 7"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export default function Beranda() {
  const router = useRouter();
  const [name, setName] = useState("Teman Ikan");
  const [articleCards, setArticleCards] = useState<HomeArticle[]>(sampleArticles.slice(0, 3));
  const [articleError, setArticleError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = getSupabase();
        const [{ data: { session } }, { data, error }] = await Promise.all([
          db.auth.getSession(),
          db.from("articles").select("slug,title,excerpt,image_url,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(3),
        ]);
        if (!active) return;
        if (!session) {
          router.replace("/");
          return;
        }
        const fullName = session.user.user_metadata?.full_name;
        setName(fullName || session.user.email?.split("@")[0] || "Teman Ikan");
        if (error) {
          setArticleError(supabaseErrorMessage(error, "Artikel terbaru gagal dimuat."));
          return;
        }
        const published: HomeArticle[] = (data || []).map(article => ({
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          image: article.image_url || "/assets/beranda-underwater.png",
          date: article.published_at ? new Date(article.published_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Artikel SehatiKan",
        }));
        const latest = [...published, ...sampleArticles.filter(article => !published.some(item => item.slug === article.slug)).map(article => ({
          slug: article.slug, title: article.title, excerpt: article.excerpt, image: article.image, date: article.date,
        }))].slice(0, 3);
        setArticleCards(latest);
      } catch (error) {
        if (active) setArticleError(supabaseErrorMessage(error, "Artikel terbaru gagal dimuat."));
      }
    })();
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/");
  }

  return <><AppNav active="beranda"/><main className="dashboard-page">
    <header className="dashboard-header">
      <span className="dashboard-brand"><img src="/assets/fish-mascot.png" alt="" /><strong>Sehati<span>Kan</span></strong></span>
      <button className="logout-button" onClick={logout}>Keluar</button>
    </header>
    <div className="home-water" aria-hidden="true" />
    <div className="dashboard-content">
    <section className="welcome-block"><h1>Halo, {name.split(" ")[0]}!</h1><p>Semoga ikan-ikanmu selalu sehat<br className="mobile-only" /> dan tumbuh dengan baik!</p></section>

    <section className="summary-card">
      <h2>Ringkasan Kondisi Ikan</h2>
      <div className="fish-overview">
        <div><strong>Data ikan</strong><b>Koi · Kolam A</b><span>Catatan pengguna, bukan diagnosis</span></div>
      </div>
      <div className="user-note"><strong>Catatan pengguna</strong><p>Kurang aktif, nafsu makan menurun sejak kemarin</p></div>
      <button className="outline-button" onClick={() => router.push("/ikan-saya")}>Lihat Data Ikan</button>
    </section>

    <button className="consult-cta" onClick={() => router.push("/konsultasi")}>Mulai Konsultasi <Icon name="arrow" /></button>
    <section className="consult-options">
      <button className="option-card" onClick={() => router.push("/konsultasi/bot")}><span className="option-avatar bot-avatar">🤖</span><span><strong>Konsultasi Bot AI</strong><small>Dapatkan informasi awal mengenai kondisi ikanmu secara cepat dan mudah.</small></span></button>
      <button className="option-card" onClick={() => router.push("/konsultasi/ahli")}><span className="option-avatar expert-avatar">👩‍⚕️</span><span><strong>Konsultasi Ahli</strong><small>Konsultasi langsung dengan spesialis kesehatan ikan.</small></span></button>
    </section>

    <section className="articles-section"><div className="section-heading"><h2>Artikel Terbaru</h2><button onClick={() => router.push("/artikel")}>Lihat semua</button></div>
      {articleError&&<p className="feedback">{articleError}</p>}
      {articleCards.map(article=><button className="article-card" key={article.slug} onClick={() => router.push(`/artikel/${article.slug}`)}><img src={article.image} alt="" /><span><strong>{article.title}</strong><small>{article.date}</small><small>{article.excerpt}</small></span></button>)}
    </section>
    </div>

    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button className="nav-item active" onClick={() => router.push("/beranda")}><Icon name="home"/><span>Beranda</span></button>
      <button className="nav-item" onClick={() => router.push("/artikel")}><Icon name="book"/><span>Artikel</span></button>
      <button className="nav-chat" aria-label="Konsultasi" onClick={() => router.push("/konsultasi")}><Icon name="chat"/></button>
      <button className="nav-item" onClick={() => router.push("/riwayat")}><Icon name="history"/><span>Riwayat</span></button>
      <button className="nav-item" onClick={() => router.push("/profil")}><Icon name="profile"/><span>Profil</span></button>
    </nav>
  </main></>;
}
