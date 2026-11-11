import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Silakan masuk ke akun SehatiKan terlebih dahulu." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseKey);
  const { data: auth, error: authError } = await authClient.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Sesi login tidak valid. Silakan masuk kembali." }, { status: 401 });

  let body: { messages?: ChatMessage[]; image?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Format pesan tidak valid." }, { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!messages.length || messages.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 5000)) {
    return NextResponse.json({ error: "Pesan kosong atau terlalu panjang." }, { status: 400 });
  }
  if (body.image && (!/^data:image\/(jpeg|png|webp);base64,/.test(body.image) || body.image.length > 7_000_000)) {
    return NextResponse.json({ error: "Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." }, { status: 400 });
  }

  const endpoint = process.env.LLAMA_CPP_URL || "http://127.0.0.1:9931/v1/chat/completions";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "local-model",
        messages: [
          { role: "system", content: "Kamu adalah asisten informasi awal SehatiKan untuk perawatan ikan. Jawab dalam Bahasa Indonesia dengan ramah, jelas, dan praktis. Jika pengguna melampirkan foto, amati hanya ciri yang benar-benar terlihat dan jelaskan keterbatasannya; jangan menyatakan diagnosis pasti. Tanyakan detail jika konteks kurang. Jangan meresepkan obat atau dosis. Beri langkah observasi dan perawatan umum yang aman, dan sarankan konsultasi ahli/pemeriksaan langsung bila ikan megap-megap, ada luka, kematian, atau kondisi memburuk. Data keluhan pengguna bukan hasil sensor." },
          ...messages.map((message, index) => body.image && index === messages.length - 1 && message.role === "user"
            ? { ...message, content: [{ type: "text", text: message.content }, { type: "image_url", image_url: { url: body.image } }] }
            : message),
        ],
        temperature: 0.35,
        max_tokens: 500,
        // Qwen3's reasoning mode can consume a small response budget without
        // producing `message.content`; disable it for the chat UI response.
        chat_template_kwargs: { enable_thinking: false },
        stream: false,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `Layanan AI lokal memberi respons ${response.status}. ${detail.slice(0, 240)}` }, { status: 502 });
    }
    const result = await response.json();
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("Model lokal tidak mengirim jawaban.");
    return NextResponse.json({ answer: answer.trim() });
  } catch (error) {
    const unavailable = error instanceof Error && (error.name === "AbortError" || error.message.includes("fetch failed"));
    return NextResponse.json({ error: unavailable ? "AI lokal belum berjalan. Jalankan llama-server di komputer ini, lalu coba kirim lagi." : error instanceof Error ? error.message : "AI lokal gagal memberi jawaban." }, { status: 503 });
  } finally { clearTimeout(timeout); }
}
