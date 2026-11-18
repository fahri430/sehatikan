"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ExpertNav from "@/components/ExpertNav";
import { getSupabase, supabaseErrorMessage } from "@/lib/supabase";

type Article = { id: string; slug: string; title: string; category: string; excerpt: string; status: string; published_at: string | null };

export default function ExpertArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Kesehatan ikan");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const db = getSupabase();
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError) throw authError;
    if (!user) {
      router.replace("/");
      return;
    }
    const { data: profile, error: profileError } = await db.from("profiles").select("user_type").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.user_type !== "expert") {
      router.replace("/beranda");
      return;
    }
    const { data, error: articleError } = await db.from("articles")
      .select("id,slug,title,category,excerpt,status,published_at")
      .or(`status.eq.published,author_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (articleError) throw articleError;
    setArticles(data || []);
  }

  useEffect(() => {
    let active = true;
    void load().catch(e => {
      if (active) setError(supabaseErrorMessage(e, "Artikel ahli gagal dimuat."));
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const db = getSupabase();
      const { data: { user }, error: authError } = await db.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Sesi login berakhir. Silakan masuk kembali.");
      const slugBase = title.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
      const slug = `${slugBase || "artikel-ahli"}-${crypto.randomUUID().slice(0, 8)}`;
      const { error: insertError } = await db.from("articles").insert({
        author_id: user.id,
        slug,
        title: title.trim(),
        category,
        excerpt: excerpt.trim(),
        body: body.trim(),
        status: "review",
      });
      if (insertError) throw insertError;
      setTitle("");
      setExcerpt("");
      setBody("");
      await load();
    } catch (e) {
      setError(supabaseErrorMessage(e, "Pengajuan artikel gagal dikirim."));
    } finally {
      setBusy(false);
    }
  }

  return <><ExpertNav active="artikel"/><main className="expert-dashboard expert-articles">
    <header className="expert-welcome"><div><h1>Artikel edukasi</h1><p>Pelajari materi yang sudah terbit dan ajukan tulisan untuk ditinjau admin.</p></div></header>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <form className="admin-panel admin-disease-form" onSubmit={submit}>
      <h2>Bagikan pengetahuan</h2>
      <p>Artikel yang dikirim akan berstatus tinjauan dan baru terlihat publik setelah diterbitkan admin.</p>
      <label>Judul<input value={title} onChange={e=>setTitle(e.target.value)} required maxLength={180}/></label>
      <label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}><option>Kesehatan ikan</option><option>Kualitas Air</option><option>Perawatan</option><option>Budidaya</option></select></label>
      <label>Ringkasan<textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} maxLength={500} required/></label>
      <label>Isi artikel<textarea value={body} onChange={e=>setBody(e.target.value)} rows={9} required/></label>
      <button className="primary" disabled={busy}>{busy?"Mengirim…":"Kirim untuk ditinjau"}</button>
    </form>
    <section className="admin-panel">
      <h2>Materi &amp; pengajuan saya</h2>
      {articles.length?articles.map(article=><article className="admin-row" key={article.id}>
        <div><b>{article.title}</b><small>{article.category} · {article.status==="review"?"Menunggu tinjauan":article.status==="published"?"Terbit":"Draf"}</small></div>
        {article.status==="published"&&<button onClick={()=>router.push(`/artikel/${article.slug}`)}>Baca</button>}
      </article>):<p>Belum ada artikel terbit atau pengajuan.</p>}
    </section>
  </main></>;
}
