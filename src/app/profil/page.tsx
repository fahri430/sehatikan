"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppNav from "@/components/AppNav";

const items = [
  { id: "akun", icon: "◉", label: "Data Akun", description: "Nama, email, dan jenis pengguna" },
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/"); return; }
      const { data: profile } = await supabase.from("profiles").select("full_name,user_type").eq("id", data.session.user.id).maybeSingle();
      setName(profile?.full_name || data.session.user.user_metadata?.full_name || data.session.user.email?.split("@")[0] || "Pengguna SehatiKan");
      setEmail(data.session.user.email || "");
    });
  }, [router]);

  async function logout() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) await createClient(url, key).auth.signOut();
    router.replace("/");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setNotice("");
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      const { data: { user } } = await db.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
      const form = new FormData(event.currentTarget); const nextName = String(form.get("full_name") || "").trim(); const nextEmail = String(form.get("email") || "").trim();
      if (!nextName || !nextEmail) throw new Error("Nama dan email wajib diisi.");
      const { error: profileError } = await db.from("profiles").update({ full_name: nextName }).eq("id", user.id);
      if (profileError) throw profileError;
      const { error: authError } = await db.auth.updateUser({ email: nextEmail, data: { ...user.user_metadata, full_name: nextName } });
      if (authError) throw authError;
      setName(nextName); setEmail(nextEmail); setEditing(false);
      setNotice(nextEmail !== user.email ? "Nama tersimpan. Periksa inbox email baru untuk mengonfirmasi perubahan alamat email." : "Profil berhasil diperbarui.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Profil gagal disimpan."); }
    finally { setSaving(false); }
  }

  function openItem(item: (typeof items)[number]) {
    if (item.id === "ikan") { router.push("/ikan-saya"); return; }
    if (item.id === "akun") { router.push("/profil/akun"); return; }
    if (item.id === "ikan") { router.push("/ikan-saya"); return; }
    router.push(`/profil/${item.id}`);
  }

  return <><AppNav active="profil"/><main className="profile-page">
    <header className="profile-header"><h1>Profil</h1><span>Kelola akun SehatiKan Anda</span></header>
    <section className="profile-content">
      <div className="profile-identity"><div className="profile-avatar" aria-hidden="true">{name.slice(0,1).toUpperCase()}</div><div className="profile-user"><strong>{name}</strong><span>{email || "Akun SehatiKan"}</span></div><button className="profile-edit" onClick={() => setEditing(true)}>Edit Profil</button></div>
      {notice && <p className="sample-note" role="status">{notice}</p>}
      <div className="profile-menu">{items.map((item) => <button id={item.id} className="profile-menu-item" key={item.id} onClick={() => openItem(item)}><span className="profile-menu-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><span className="profile-chevron">›</span></button>)}
        <button className="profile-menu-item profile-logout" onClick={logout}><span className="profile-menu-icon">↪</span><span><strong>Logout</strong><small>Keluar dari akun Anda</small></span><span className="profile-chevron">›</span></button>
      </div>
    </section>
    {editing && <div className="history-overlay" onClick={() => setEditing(false)}><form className="history-dialog profile-dialog" onSubmit={saveProfile} onClick={(event) => event.stopPropagation()}><button type="button" className="history-dialog-close" onClick={() => setEditing(false)} aria-label="Tutup">×</button><h2>Edit Profil</h2><label>Nama lengkap<input name="full_name" defaultValue={name} required maxLength={100}/></label><label>Email<input name="email" type="email" defaultValue={email} required/></label><p>Perubahan email memerlukan konfirmasi melalui inbox.</p><button className="primary" disabled={saving}>{saving ? "Menyimpan…" : "Simpan perubahan"}</button></form></div>}
    {selected && <div className="history-overlay" onClick={() => setSelected(null)}><section className="history-dialog profile-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><button className="history-dialog-close" onClick={() => setSelected(null)} aria-label="Tutup">×</button><span className="profile-menu-icon" aria-hidden="true">{selected.icon}</span><h2>{selected.label}</h2><p>{selected.description}</p>{selected.id === "pengaturan" && <div className="profile-settings"><p>Keamanan akun menggunakan autentikasi Supabase.</p><button onClick={async()=>{const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/reset-password`});setNotice(error?error.message:"Tautan pengaturan kata sandi telah dikirim ke email.");setSelected(null);}}>Kirim tautan ubah kata sandi</button></div>}{selected.id === "bantuan" && <p>Gunakan Data Ikan untuk mencatat kondisi kolam, lalu mulai konsultasi Bot AI atau cari ahli untuk mendapatkan arahan.</p>}{selected.id === "tentang" && <p>SehatiKan membantu pemilik ikan mencatat kondisi dan mengakses informasi edukatif seputar kesehatan ikan.</p>}</section></div>}
  </main></>;
}
