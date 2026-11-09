"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";

type Consultation = { fish: string; date: string; status: string; note: string; position: string };
const botHistory: Consultation[] = [
  { fish: "Ikan Koi", date: "3 Okt 2026 · 14.32", status: "Selesai", note: "Pengecekan awal terkait ikan yang terlihat kurang aktif dan nafsu makan menurun.", position: "center 34%" },
  { fish: "Ikan Nila", date: "28 Sep 2026 · 10.15", status: "Selesai", note: "Diskusi mengenai perubahan perilaku dan kualitas air kolam.", position: "center 55%" },
  { fish: "Ikan Lele", date: "20 Sep 2026 · 16.47", status: "Selesai", note: "Konsultasi tentang pola pemberian pakan dan kondisi kolam.", position: "center 70%" },
  { fish: "Ikan Mas", date: "12 Sep 2026 · 09.30", status: "Selesai", note: "Informasi perawatan rutin untuk menjaga kondisi ikan.", position: "center 42%" },
  { fish: "Ikan Gurame", date: "9 Sep 2026 · 11.02", status: "Selesai", note: "Tanya jawab seputar pemantauan ikan dan lingkungan kolam.", position: "center 78%" },
];
const expertHistory: Consultation[] = [
  { fish: "Ikan Koi", date: "5 Okt 2026 · 13.10", status: "Selesai", note: "Konsultasi ahli mengenai observasi kondisi ikan dan langkah pemantauan berikutnya.", position: "center 34%" },
  { fish: "Ikan Nila", date: "24 Sep 2026 · 08.45", status: "Selesai", note: "Diskusi dengan ahli mengenai kualitas air dan perawatan kolam.", position: "center 55%" },
];

export default function RiwayatPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "ahli">("bot");
  const [selected, setSelected] = useState<Consultation | null>(null);
  const rows = tab === "bot" ? botHistory : expertHistory;

  return <><AppNav active="riwayat"/><main className="history-page">
    <header className="history-header"><button className="article-brand" onClick={() => router.push("/beranda")} aria-label="Ke Beranda"><img src="/assets/fish-mascot.png" alt=""/><strong>Sehati<span>Kan</span></strong></button><h1>Riwayat</h1><button className="history-home-link" onClick={() => router.push("/beranda")}>Beranda</button></header>
    <div className="history-water" aria-hidden="true" />
    <section className="history-content">
      <div className="history-tabs" role="tablist" aria-label="Jenis konsultasi">
        <button role="tab" aria-selected={tab === "bot"} className={tab === "bot" ? "selected" : ""} onClick={() => setTab("bot")}>Konsultasi Bot</button>
        <button role="tab" aria-selected={tab === "ahli"} className={tab === "ahli" ? "selected" : ""} onClick={() => setTab("ahli")}>Konsultasi Ahli</button>
      </div>
      {rows.length ? <div className="history-list">{rows.map((row) => <button className="history-card" key={`${row.fish}-${row.date}`} onClick={() => setSelected(row)}>
        <img src="/assets/beranda-underwater.png" alt="" style={{ objectPosition: row.position }}/>
        <span className="history-card-copy"><strong>{row.fish}</strong><small>{row.date}</small></span><span className="history-status">{row.status}</span>
      </button>)}</div> : <div className="history-empty"><strong>Belum ada riwayat</strong><p>Riwayat konsultasi akan muncul di sini.</p></div>}
    </section>
    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button className="nav-item" onClick={() => router.push("/beranda")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg><span>Beranda</span></button>
      <button className="nav-item" onClick={() => router.push("/artikel")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg><span>Artikel</span></button>
      <button className="nav-chat" aria-label="Konsultasi" onClick={() => router.push("/konsultasi")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.8L4 20l1.4-4A7 7 0 0 1 5 12c0-4.1 3.6-7.5 8-7.5s8 3 8 7z"/><path d="M9 12h.01M13 12h.01M17 12h.01"/></svg></button>
      <button className="nav-item active" onClick={() => router.push("/riwayat")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2"/></svg><span>Riwayat</span></button>
      <button className="nav-item" onClick={() => router.push("/profil")}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Profil</span></button>
    </nav>
    {selected && <div className="history-overlay" role="presentation" onClick={() => setSelected(null)}><section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-dialog-title" onClick={(event) => event.stopPropagation()}><button className="history-dialog-close" onClick={() => setSelected(null)} aria-label="Tutup">×</button><span className="history-status">Selesai</span><h2 id="history-dialog-title">{selected.fish}</h2><time>{selected.date}</time><p>{selected.note}</p><button className="primary" onClick={() => setSelected(null)}>Tutup detail</button></section></div>}
  </main></>;
}
