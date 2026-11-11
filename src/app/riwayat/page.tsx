"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getSupabase } from "@/lib/supabase";

type Consultation = { id?:string; fish: string; date: string; status: string; note: string; position: string; transcript?: {role:string;content:string;image_name?:string|null}[] };
const expertHistory: Consultation[] = [
  { fish: "Ikan Koi", date: "5 Okt 2026 · 13.10", status: "Selesai", note: "Konsultasi ahli mengenai observasi kondisi ikan dan langkah pemantauan berikutnya.", position: "center 34%" },
  { fish: "Ikan Nila", date: "24 Sep 2026 · 08.45", status: "Selesai", note: "Diskusi dengan ahli mengenai kualitas air dan perawatan kolam.", position: "center 55%" },
];

export default function RiwayatPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"bot" | "ahli">("bot");
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [botHistory,setBotHistory]=useState<Consultation[]>([]);const [botLoading,setBotLoading]=useState(true);const [botError,setBotError]=useState("");
  useEffect(()=>{let alive=true;(async()=>{try{const db=getSupabase();const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Masuk untuk melihat riwayat chat Bot AI.");const {data:threads,error}=await db.from("ai_conversations").select("id,title,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false});if(error)throw error;const ids=(threads||[]).map(t=>t.id);const {data:messages,error:messageError}=ids.length?await db.from("ai_messages").select("conversation_id,role,content,image_name,created_at").in("conversation_id",ids).order("created_at",{ascending:true}):{data:[],error:null};if(messageError)throw messageError;const mapped=(threads||[]).map(t=>{const transcript=(messages||[]).filter(m=>m.conversation_id===t.id);const prompt=transcript.find(m=>m.role==="user");const answer=[...transcript].reverse().find(m=>m.role==="assistant");return{id:t.id,fish:t.title||"Konsultasi Bot AI",date:new Date(t.updated_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}),status:"Tersimpan",note:prompt?.content||"Belum ada prompt",position:"center",transcript:transcript.map(m=>({role:m.role,content:m.content,image_name:m.image_name}))};});if(alive)setBotHistory(mapped);}catch(e){if(alive)setBotError(e instanceof Error?(e as any).code==="PGRST205"?"Tabel riwayat belum aktif. Jalankan supabase/SETUP_SEHATIKAN.sql di Supabase SQL Editor.":e.message:"Riwayat gagal dimuat.");}finally{if(alive)setBotLoading(false);}})();return()=>{alive=false}},[]);
  const rows = tab === "bot" ? botHistory : expertHistory;

  return <><AppNav active="riwayat"/><main className="history-page">
    <header className="history-header"><button className="article-brand" onClick={() => router.push("/beranda")} aria-label="Ke Beranda"><img src="/assets/fish-mascot.png" alt=""/><strong>Sehati<span>Kan</span></strong></button><h1>Riwayat</h1><button className="history-home-link" onClick={() => router.push("/beranda")}>Beranda</button></header>
    <div className="history-water" aria-hidden="true" />
    <section className="history-content">
      <div className="history-tabs" role="tablist" aria-label="Jenis konsultasi">
        <button role="tab" aria-selected={tab === "bot"} className={tab === "bot" ? "selected" : ""} onClick={() => setTab("bot")}>Konsultasi Bot</button>
        <button role="tab" aria-selected={tab === "ahli"} className={tab === "ahli" ? "selected" : ""} onClick={() => setTab("ahli")}>Konsultasi Ahli</button>
      </div>
      {tab==="bot"&&botError&&<p className="sample-note">{botError}</p>}{tab==="bot"&&botLoading?<div className="history-empty">Memuat riwayat chat…</div>:rows.length ? <div className="history-list">{rows.map((row) => <button className="history-card" key={row.id||`${row.fish}-${row.date}`} onClick={() => setSelected(row)}>
        {tab==="bot"?<span className="bot-avatar" aria-hidden="true">AI</span>:<img src="/assets/beranda-underwater.png" alt="" style={{ objectPosition: row.position }}/>}
        <span className="history-card-copy"><strong>{row.fish}</strong><small>{row.date}</small><small>{row.note.slice(0,110)}{row.note.length>110?"…":""}</small></span><span className="history-status">{row.status}</span>
      </button>)}</div> : <div className="history-empty"><strong>Belum ada riwayat</strong><p>{tab==="bot"?"Prompt dan hasil percakapan Bot AI akan muncul di sini.":"Riwayat konsultasi ahli akan muncul di sini."}</p>{tab==="bot"&&<button onClick={()=>router.push("/konsultasi/bot")}>Mulai chat</button>}</div>}
    </section>
    <nav className="bottom-nav" aria-label="Navigasi utama">
      <button className="nav-item" onClick={() => router.push("/beranda")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/></svg><span>Beranda</span></button>
      <button className="nav-item" onClick={() => router.push("/artikel")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21zM4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/></svg><span>Artikel</span></button>
      <button className="nav-chat" aria-label="Konsultasi" onClick={() => router.push("/konsultasi")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.8L4 20l1.4-4A7 7 0 0 1 5 12c0-4.1 3.6-7.5 8-7.5s8 3 8 7z"/><path d="M9 12h.01M13 12h.01M17 12h.01"/></svg></button>
      <button className="nav-item active" onClick={() => router.push("/riwayat")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5M12 7v5l3 2"/></svg><span>Riwayat</span></button>
      <button className="nav-item" onClick={() => router.push("/profil")}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Profil</span></button>
    </nav>
    {selected && <div className="history-overlay" role="presentation" onClick={() => setSelected(null)}><section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-dialog-title" onClick={(event) => event.stopPropagation()}><button className="history-dialog-close" onClick={() => setSelected(null)} aria-label="Tutup">×</button><span className="history-status">{selected.status}</span><h2 id="history-dialog-title">{selected.fish}</h2><time>{selected.date}</time>{selected.transcript?.length?<div className="history-transcript">{selected.transcript.map((message,i)=><article className={`history-message ${message.role}`} key={`${i}-${message.role}`}><strong>{message.role==="user"?"Anda":"Bot AI"}</strong><p>{message.content}</p>{message.image_name&&<small>Lampiran: {message.image_name}</small>}</article>)}</div>:<p>{selected.note}</p>}<button className="primary" onClick={()=>selected.id&&tab==="bot"?router.push(`/konsultasi/bot?conversation=${selected.id}`):setSelected(null)}>Buka kembali percakapan</button></section></div>}
  </main></>;
}
