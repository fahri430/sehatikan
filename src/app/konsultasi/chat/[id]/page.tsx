"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getSupabase } from "@/lib/supabase";

type Message = { id: string; sender_id: string; sender_role: "user" | "expert"; body: string; created_at: string };
type Session = { id: string; user_id: string; expert_user_id: string; complaint: string; fish_context: Record<string, string>; status: string };

export default function FarmerConsultationChat() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [expertName, setExpertName] = useState("Ahli SehatiKan");
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    const db = getSupabase();
    const { data, error: loadError } = await db.from("consultation_messages").select("id,sender_id,sender_role,body,created_at").eq("consultation_id", id).order("created_at");
    if (loadError) setError(loadError.message); else setMessages(data || []);
  }, [id]);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof getSupabase>["channel"]> | undefined;
    let live = true;
    (async () => {
      try {
        const db = getSupabase();
        const { data: auth } = await db.auth.getUser();
        if (!auth.user) { router.replace("/"); return; }
        if (!live) return;
        setUserId(auth.user.id);
        const { data, error: sessionError } = await db.from("consultations").select("id,user_id,expert_user_id,complaint,fish_context,status").eq("id", id).single();
        if (sessionError) throw sessionError;
        setSession(data);
        const { data: expert } = await db.from("expert_profiles").select("full_name").eq("user_id", data.expert_user_id).maybeSingle();
        if (expert?.full_name) setExpertName(expert.full_name);
        await loadMessages();
        channel = db.channel(`consultation-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "consultation_messages", filter: `consultation_id=eq.${id}` }, () => { void loadMessages(); }).subscribe();
      } catch (e) { if (live) setError(e instanceof Error ? e.message : "Percakapan tidak dapat dimuat."); }
    })();
    return () => { live = false; if (channel) void getSupabase().removeChannel(channel); };
  }, [id, loadMessages, router]);

  async function send(e: FormEvent) {
    e.preventDefault(); const body = draft.trim();
    if (!body || !userId || sending || session?.status === "completed") return;
    setSending(true); setError("");
    const { error: sendError } = await getSupabase().from("consultation_messages").insert({ consultation_id: id, sender_id: userId, sender_role: "user", body });
    if (sendError) setError(sendError.message); else { setDraft(""); await loadMessages(); }
    setSending(false);
  }

  const fish = session?.fish_context?.pond || "Data ikan";
  return <><AppNav active="konsultasi"/><main className="live-chat-page"><button className="profile-back" onClick={() => router.push("/riwayat")}>← Kembali</button><header className="live-chat-header"><span className="expert-avatar-placeholder">♟</span><span><h1>{expertName}</h1><small>Ahli kesehatan ikan · {session?.status === "completed" ? "Sesi selesai" : "Konsultasi aktif"}</small></span></header><section className="live-chat-context"><strong>{fish}</strong><small>{session?.complaint || "Memuat ringkasan konsultasi…"}</small></section><p className="live-chat-disclaimer">Percakapan langsung antara Anda dan ahli. Informasi ahli bukan pengganti pemeriksaan langsung.</p><section className="live-chat-messages" aria-live="polite">{messages.map(m=><article key={m.id} className={`live-chat-bubble ${m.sender_id === userId ? "mine" : "theirs"}`}><small>{m.sender_id === userId ? "Anda" : expertName} · {new Date(m.created_at).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}</small><p>{m.body}</p></article>)}{!messages.length&&<p className="sample-note">Mulai percakapan dengan mengirim pesan kepada ahli.</p>}</section>{error&&<p className="feedback">{error}</p>}<form className="live-chat-composer" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={session?.status === "completed" ? "Sesi ini telah selesai" : "Tulis pesan…"} disabled={session?.status === "completed"}/><button className="primary" disabled={sending||!draft.trim()||session?.status === "completed"}>{sending?"…":"Kirim"}</button></form></main></>;
}
