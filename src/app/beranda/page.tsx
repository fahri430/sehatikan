"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppNav from "@/components/AppNav";

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

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      const fullName = data.session.user.user_metadata?.full_name;
      setName(fullName || data.session.user.email?.split("@")[0] || "Teman Ikan");
    });
  }, [router]);

  async function logout() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) await createClient(url, key).auth.signOut();
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
      <button className="article-card" onClick={() => router.push("/artikel/mencegah-penyakit-koi")}><img src="/assets/beranda-underwater.png" alt="Ikan koi di bawah air" /><span><strong>Cara Mencegah Penyakit pada Ikan Koi</strong><small>12 Oktober 2026</small></span></button>
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
