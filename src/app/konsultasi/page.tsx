"use client";

import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";

export default function ConsultationMethod() {
  const router = useRouter();
  return <><AppNav active="konsultasi"/><main className="consult-page">
    <header className="consult-top"><button onClick={() => router.push("/beranda")} aria-label="Kembali">←</button><span>Pilih metode konsultasi yang<br/>kamu butuhkan</span><span/></header>
    <section className="consult-methods">
      <button className="consult-method-card" onClick={() => router.push("/konsultasi/bot")}><span className="method-avatar bot-avatar">🤖</span><span><strong>Konsultasi Bot AI</strong><small>Dapatkan informasi awal mengenai kondisi ikanmu secara cepat dan mudah.</small></span><b>›</b></button>
      <button className="consult-method-card" onClick={() => router.push("/konsultasi/ahli")}><span className="method-avatar expert-avatar">👩‍⚕️</span><span><strong>Konsultasi Ahli</strong><small>Konsultasi langsung dengan spesialis kesehatan ikan.</small></span><b>›</b></button>
    </section>
  </main></>;
}
