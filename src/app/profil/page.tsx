"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppNav from "@/components/AppNav";

const items = [
  { id: "akun", icon: "♟", label: "Data Akun", description: "Nama, email, dan jenis pengguna" },
  { id: "ikan", icon: "▣", label: "Data Ikan", description: "Kelola ikan dan kolam Anda" },
  { id: "pembayaran", icon: "▰", label: "Riwayat Pembayaran", description: "Lihat transaksi konsultasi" },
  { id: "pengaturan", icon: "⚙", label: "Pengaturan Akun", description: "Keamanan dan preferensi akun" },
  { id: "bantuan", icon: "?", label: "Bantuan", description: "Panduan menggunakan SehatiKan" },
  { id: "tentang", icon: "ⓘ", label: "Tentang", description: "Informasi tentang SehatiKan" },
];

export default function ProfilPage() {
  const router = useRouter();
  const [name, setName] = useState("Pengguna SehatiKan");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<(typeof items)[number] | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/"); return; }
      setName(data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "Pengguna SehatiKan");
      setEmail(data.session.user.email || "");
    });
  }, [router]);

  async function logout() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) await createClient(url, key).auth.signOut();
    router.replace("/");
  }

  return <><AppNav active="profil"/><main className="profile-page">
    <header className="profile-header"><h1>Profil</h1><span>Kelola akun SehatiKan Anda</span></header>
    <section className="profile-content">
      <div className="profile-identity"><div className="profile-avatar" aria-hidden="true">{name.slice(0,1).toUpperCase()}</div><div className="profile-user"><strong>{name}</strong><span>{email || "Akun SehatiKan"}</span></div><button className="profile-edit" onClick={() => setSelected(items[0])}>Edit Profil</button></div>
      <div className="profile-menu">{items.map((item) => <button id={item.id} className="profile-menu-item" key={item.id} onClick={() => setSelected(item)}><span className="profile-menu-icon">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><span className="profile-chevron">›</span></button>)}
        <button className="profile-menu-item profile-logout" onClick={logout}><span className="profile-menu-icon">↪</span><span><strong>Logout</strong><small>Keluar dari akun Anda</small></span><span className="profile-chevron">›</span></button>
      </div>
    </section>
    {selected && <div className="history-overlay" onClick={() => setSelected(null)}><section className="history-dialog profile-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="history-dialog-close" onClick={() => setSelected(null)} aria-label="Tutup">×</button><span className="profile-menu-icon">{selected.icon}</span><h2>{selected.label}</h2><p>{selected.id === "akun" ? `Nama: ${name}\nEmail: ${email || "Belum tersedia"}` : selected.description}</p>{selected.id === "ikan" && <button className="primary" onClick={() => { setSelected(null); router.push("/ikan-saya"); }}>Buka Data Ikan</button>}</section></div>}
  </main></>;
}
