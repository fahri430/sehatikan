"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";

type Message = { from: "user" | "bot"; text: string; image?: string };
const initial: Message[] = [
  { from: "bot", text: "Contoh percakapan. Pesan dan foto di layar ini tidak benar-benar dikirim." },
  { from: "user", text: "Ikan koi di Kolam A kurang aktif sejak kemarin dan nafsu makannya menurun. Apa yang perlu saya periksa?", image: "/assets/beranda-underwater.png" },
  { from: "bot", text: "Terima kasih sudah bercerita. Kurang aktif dan nafsu makan menurun bisa berkaitan dengan stres, lingkungan, atau gangguan kesehatan. Gejala saja belum cukup untuk memastikan diagnosis.\n\nLangkah awal yang aman:\n1. Amati gerakan, napas, perubahan kulit, dan jumlah ikan terdampak.\n2. Periksa aerasi dan filter. Ukur suhu serta pH bila alat tersedia.\n3. Hindari perubahan air mendadak atau pemberian obat tanpa arahan ahli.\n\nJika kondisi memburuk, konsultasikan kepada ahli kesehatan ikan." },
];

export default function BotConversation() {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const inputFile = useRef<HTMLInputElement>(null);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() && !preview) return;
    setMessages((current) => [...current, { from: "user", text: text.trim() || "Foto ikan terlampir.", image: preview || undefined }]);
    setText(""); setPreview(null);
  }

  function choosePhoto(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(file));
  }

  return <><AppNav active="konsultasi"/><main className="chat-page">
    <header className="chat-header"><button onClick={() => router.push("/konsultasi")} aria-label="Kembali">←</button><div><h1>Konsultasi Bot AI</h1><span>Koi · Kolam A</span></div></header>
    <div className="chat-water" aria-hidden="true"/>
    <section className="chat-context"><span className="bot-avatar">🤖</span><span><strong>Koi · Kolam A</strong><small>AI · Informasi awal, bukan diagnosis</small></span></section>
    <div className="chat-messages" aria-live="polite">{messages.map((message, i) => <article className={`chat-message ${message.from}`} key={i}>{message.from === "bot" && <span className="chat-bot-label">Bot AI SehatiKan</span>}<p>{message.text}</p>{message.image && <img className="chat-attachment" src={message.image} alt="Lampiran ikan"/>}</article>)}</div>
    <aside className="chat-warning"><strong>Butuh penilaian lebih lanjut?</strong><p>Jika ikan megap-megap, muncul luka, atau kondisi memburuk, konsultasikan kepada ahli.</p><button className="primary" onClick={() => router.push("/konsultasi/ahli")}>Konsultasi Ahli</button></aside>
    <form className="chat-composer" onSubmit={send}>{preview && <div className="upload-preview"><img src={preview} alt="Pratinjau foto"/><button type="button" onClick={() => setPreview(null)}>Hapus</button></div>}<div className="composer-row"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan..." aria-label="Tulis pesan"/><button className="send-button" type="submit" aria-label="Kirim pesan">↑</button></div><input ref={inputFile} type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0])}/><button className="upload-button" type="button" onClick={() => inputFile.current?.click()}>+ Tambah / unggah foto</button><small>Kirim · Pratinjau saja, bukan layanan aktif.</small></form>
  </main></>;
}
