"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ExpertNav from "@/components/ExpertNav";
import { getSupabase } from "@/lib/supabase";

type Message = { id: string; sender_id: string; sender_role: "user" | "expert"; body: string; created_at: string };
type Session = { id: string; user_id: string; expert_user_id: string; complaint: string; fish_context: Record<string, string>; status: string; final_recommendation: string | null; scheduled_for: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function ExpertConversation() {
  const { id } = useParams<{ id: string }>(); const router = useRouter();
  const [session, setSession] = useState<Session | null>(null); const [messages, setMessages] = useState<Message[]>([]);
  const [expertId, setExpertId] = useState(""); const [name, setName] = useState("Peternak SehatiKan");
  const [draft, setDraft] = useState(""); const [recommendation, setRecommendation] = useState(""); const [editing, setEditing] = useState(false);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [finish, setFinish] = useState(false); const [error, setError] = useState("");
  const loadMessages = useCallback(async () => { const { data, error: e } = await getSupabase().from("consultation_messages").select("id,sender_id,sender_role,body,created_at").eq("consultation_id", id).order("created_at"); if (e) setError(e.message); else setMessages(data || []); }, [id]);

  useEffect(() => {
    if (!uuid.test(id)) { setError("Tiket contoh hanya simulasi. Tiket konsultasi nyata dibuka dari database."); return; }
    let channel: ReturnType<ReturnType<typeof getSupabase>["channel"]> | undefined; let live = true;
    (async () => { try {
      const db = getSupabase(); const { data: auth } = await db.auth.getUser(); if (!auth.user) { router.replace("/"); return; }
      if (!live) return; setExpertId(auth.user.id);
      const { data, error: e } = await db.from("consultations").select("id,user_id,expert_user_id,complaint,fish_context,status,final_recommendation,scheduled_for").eq("id", id).single();
      if (e) throw e; if (data.expert_user_id !== auth.user.id) throw new Error("Sesi ini bukan milik akun ahli yang sedang masuk.");
      setSession(data); setRecommendation(data.final_recommendation || "");
      const { data: profile } = await db.from("profiles").select("full_name").eq("id", data.user_id).maybeSingle(); if (profile?.full_name) setName(profile.full_name);
      await loadMessages(); channel = db.channel(`expert-consultation-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "consultation_messages", filter: `consultation_id=eq.${id}` }, () => { void loadMessages(); }).subscribe();
    } catch (e) { if (live) setError(e instanceof Error ? e.message : "Kasus tidak dapat dimuat."); } })();
    return () => { live = false; if (channel) void getSupabase().removeChannel(channel); };
  }, [id, loadMessages, router]);

  async function send(e: FormEvent) { e.preventDefault(); const body = text.trim(); if (!body || !expertId || !session || busy || session.status === "completed") return; setBusy(true); setError(""); const { error: e2 } = await getSupabase().from("consultation_messages").insert({ consultation_id: id, sender_id: expertId, sender_role: "expert", body }); if (e2) setError(e2.message); else { setText(""); await loadMessages(); } setBusy(false); }
  async function saveRecommendation() { if (!session) return; setBusy(true); const { error: e } = await getSupabase().from("consultations").update({ final_recommendation: recommendation, updated_at: new Date().toISOString() }).eq("id", id); if (e) setError(e.message); else { setSession({ ...session, final_recommendation: recommendation }); setEditing(false); } setBusy(false); }
  async function completeSession() { if (!session) return; setBusy(true); const { error: e } = await getSupabase().from("consultations").update({ status: "completed", final_recommendation: recommendation, updated_at: new Date().toISOString() }).eq("id", id); if (e) setError(e.message); else { setSession({ ...session, status: "completed", final_recommendation: recommendation }); setFinish(false); } setBusy(false); }

  const fish = session?.fish_context?.pond || "Konteks ikan belum diisi";
  return <><ExpertNav active="percakapan"/><main className="expert-chat-page"><button className="profile-back" onClick={() => router.push(`/ahli/tiket/${id}`)}>← Kembali ke detail kasus</button>{error&&!session?<section className="profile-panel"><h2>Percakapan tidak dapat dimuat</h2><p>{error}</p><button className="outline-button" onClick={()=>router.push("/ahli/tiket")}>Kembali ke daftar tiket</button></section>:<><header className="expert-chat-head"><span className="expert-avatar-placeholder">♟</span><span><strong>{name}</strong><small>Peternak · {session?.status === "completed" ? "Sesi selesai" : "Konsultasi aktif"}</small></span></header><article className="chat-context"><span><strong>{fish}</strong><small>{session?.scheduled_for || "Konsultasi ahli"}</small></span><button onClick={() => router.push(`/ahli/tiket/${id}`)}>Detail Kasus</button></article><section className="expert-chat-messages" aria-live="polite">{session&&<article className="expert-chat-bubble farmer"><small>Keluhan awal</small>{session.complaint}</article>}{messages.map(m=><article key={m.id} className={`expert-chat-bubble ${m.sender_id === expertId ? "user" : "expert"}`}><small>{m.sender_id === expertId ? "Anda · Ahli" : name} · {new Date(m.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</small>{m.body}</article>)}</section>{error&&<p className="feedback">{error}</p>}<section className="recommendation-card"><div><h2>Rekomendasi &amp; tindak lanjut</h2><span>{session?.final_recommendation?"Tersimpan":"Draf"}</span></div>{editing?<><textarea value={recommendation} onChange={e=>setRecommendation(e.target.value)} placeholder="Tulis ringkasan edukatif untuk peternak"/><button disabled={busy} onClick={saveRecommendation}>Simpan Rekomendasi</button></>:<><p>{recommendation||"Tambahkan ringkasan rekomendasi agar tersimpan pada kasus ini."}</p><button onClick={()=>setEditing(true)}>Edit Rekomendasi</button></>}</section><div className="sample-note">Panduan edukatif, bukan resep definitif. Anjurkan pemeriksaan langsung bila keluhan menetap atau memburuk.</div>{session?.status !== "completed"&&<><form className="expert-chat-composer" onSubmit={send}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Tulis pesan…"/><button className="send-button" disabled={busy||!text.trim()} aria-label="Kirim">↑</button></form><button className="primary expert-wide-button" onClick={()=>setFinish(true)}>Selesaikan Kasus</button></>}{session?.status === "completed"&&<p className="sample-note">Kasus selesai. Pesan baru tidak dapat dikirim.</p>}</>}{finish&&<div className="history-overlay" onClick={()=>setFinish(false)}><section className="history-dialog" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="history-dialog-close" onClick={()=>setFinish(false)}>×</button><h2>Selesaikan kasus ini?</h2><p>Ringkasan akhir dan status sesi akan tersimpan untuk peternak.</p><div className="sample-note">{recommendation||"Tambahkan rekomendasi sebelum menyelesaikan sesi."}</div><button className="primary" disabled={busy} onClick={completeSession}>Ya, Selesaikan Kasus</button><button className="outline-button" onClick={()=>setFinish(false)}>Batal, Lanjutkan Chat</button></section></div>}</main></>;
}
