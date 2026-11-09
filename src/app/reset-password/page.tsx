"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default function ResetPassword() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");
    if (password.length < 8) return setNotice("Gunakan kata sandi minimal 8 karakter.");
    if (password !== confirmation) return setNotice("Konfirmasi kata sandi belum sama.");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || url.includes("your-project") || key.includes("your-supabase")) return setNotice("Konfigurasi Supabase belum diisi pada file .env.local.");

    setBusy(true);
    try {
      const supabase = createClient(url, key);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setNotice("Kata sandi berhasil diperbarui. Silakan masuk kembali.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Kata sandi gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="reset-shell"><section className="reset-card">
    <img src="/assets/sehatikan-identity.png" alt="SehatiKan" />
    <h1>Buat kata sandi baru</h1>
    <p>Masukkan kata sandi baru untuk akun SehatiKan Anda.</p>
    <form onSubmit={updatePassword}>
      <label htmlFor="password">Kata sandi baru</label>
      <input id="password" name="password" type="password" autoComplete="new-password" placeholder="Minimal 8 karakter" required />
      <label htmlFor="confirmation">Konfirmasi kata sandi</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" placeholder="Ulangi kata sandi" required />
      <p className="feedback" role="status">{notice}</p>
      <button className="primary" type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan Kata Sandi"}</button>
    </form>
    <Link href="/">Kembali ke halaman masuk</Link>
  </section></main>;
}
