"use client";

import { useRouter } from "next/navigation";

type Section = "beranda" | "artikel" | "konsultasi" | "riwayat" | "profil";
const entries: { id: Section; label: string; icon: string; href: string }[] = [
  { id: "beranda", label: "Beranda", icon: "⌂", href: "/beranda" },
  { id: "artikel", label: "Artikel", icon: "▤", href: "/artikel" },
  { id: "konsultasi", label: "Konsultasi", icon: "◉", href: "/konsultasi" },
  { id: "riwayat", label: "Riwayat", icon: "◷", href: "/riwayat" },
  { id: "profil", label: "Profil", icon: "◌", href: "/profil" },
];

export default function AppNav({ active }: { active: Section }) {
  const router = useRouter();
  return <>
    <aside className="app-sidebar">
      <button className="sidebar-brand" onClick={() => router.push("/beranda")}><img src="/assets/fish-mascot.png" alt=""/><span>Sehati<span>Kan</span></span></button>
      <span className="sidebar-label">MENU UTAMA</span>
      <nav>{entries.map((entry) => <button key={entry.id} className={active === entry.id ? "sidebar-link active" : "sidebar-link"} onClick={() => router.push(entry.href)}><span className="sidebar-icon">{entry.icon}</span>{entry.label}</button>)}</nav>
      <div className="sidebar-help"><strong>Pusat bantuan</strong><p>Panduan menggunakan SehatiKan.</p><button onClick={() => router.push("/profil#bantuan")}>Buka panduan →</button></div>
      <div className="sidebar-foot"><span className="sidebar-avatar">SK</span><span><strong>SehatiKan</strong><small>Teman kesehatan ikan</small></span></div>
    </aside>
    <nav className="bottom-nav app-bottom-nav" aria-label="Navigasi utama">
      {entries.filter((entry) => entry.id !== "konsultasi").slice(0, 2).map((entry) => <button key={entry.id} className={active === entry.id ? "nav-item active" : "nav-item"} onClick={() => router.push(entry.href)}><span className="mobile-nav-icon">{entry.icon}</span><span>{entry.label}</span></button>)}
      <button className="nav-chat" aria-label="Konsultasi" onClick={() => router.push("/konsultasi")}><span>•••</span></button>
      {entries.slice(3).map((entry) => <button key={entry.id} className={active === entry.id ? "nav-item active" : "nav-item"} onClick={() => router.push(entry.href)}><span className="mobile-nav-icon">{entry.icon}</span><span>{entry.label}</span></button>)}
    </nav>
  </>;
}
