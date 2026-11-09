"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Mode = "login" | "register";
type Notice = { text: string; kind: "error" | "success" | "info" } | null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function hasSupabaseConfig(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes("your-project") &&
    !supabaseKey.includes("your-supabase") &&
    !supabaseKey.includes("your-project"),
  );
}

function getSupabase(remember: boolean): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null;
  const storage = typeof window === "undefined" ? undefined : remember ? window.localStorage : window.sessionStorage;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: remember, autoRefreshToken: true, detectSessionInUrl: true, storage },
  });
}

export default function Home() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [mode, setMode] = useState<Mode>("login");
  const [registerType, setRegisterType] = useState("beginner");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  function start() {
    setShowSplash(false);
    window.setTimeout(() => document.getElementById("email")?.focus(), 100);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice(null);
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const fullName = String(data.get("fullName") ?? "").trim();
    if (!email || !password) {
      setNotice({ text: "Masukkan email dan kata sandi untuk melanjutkan.", kind: "error" });
      return;
    }
    if (mode === "register" && !fullName) {
      setNotice({ text: "Masukkan nama lengkap Anda.", kind: "error" });
      return;
    }
    if (mode === "register" && password.length < 8) {
      setNotice({ text: "Gunakan kata sandi minimal 8 karakter.", kind: "error" });
      return;
    }
    const supabase = getSupabase(remember);
    if (!supabase) {
      setNotice({ text: "Konfigurasi Supabase masih berupa contoh. Isi URL project dan publishable key pada .env.local, lalu mulai ulang server.", kind: "info" });
      return;
    }

    setBusy(true);
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, user_type: registerType } } });
      if (result.error) throw result.error;
      if (mode === "login" || result.data.session) {
        router.replace(result.data.user?.user_metadata?.user_type === "expert" ? "/ahli" : "/beranda");
        return;
      }
      setNotice(mode === "login"
        ? { text: "Berhasil masuk. Sesi Anda sudah tersimpan.", kind: "success" }
        : { text: result.data.session ? "Akun berhasil dibuat dan Anda sudah masuk." : "Akun berhasil dibuat. Periksa email untuk konfirmasi sebelum masuk.", kind: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
      setNotice({ text: message === "Failed to fetch" ? "Tidak dapat terhubung ke Supabase. Periksa URL project dan publishable key di .env.local, lalu mulai ulang server." : message, kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setNotice(null);
    const email = (document.getElementById("email") as HTMLInputElement | null)?.value.trim();
    if (!email) {
      setNotice({ text: "Masukkan email terdaftar terlebih dahulu.", kind: "error" });
      return;
    }
    const supabase = getSupabase(true);
    if (!supabase) {
      setNotice({ text: "Konfigurasi Supabase masih berupa contoh. Isi URL project dan publishable key pada .env.local, lalu mulai ulang server.", kind: "info" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setNotice({ text: "Tautan pemulihan kata sandi dikirim ke email Anda.", kind: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Tautan pemulihan gagal dikirim.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode((current) => current === "login" ? "register" : "login");
    setNotice(null);
  }

  return (
    <main className="page-shell">
      {showSplash && <section className="splash" aria-label="SehatiKan">
        <div className="splash-wash" />
        <img className="splash-brand" src="/assets/sehatikan-identity.png" alt="SehatiKan" />
        <p className="splash-tagline">Sehat Ikannya, Tenang Pengelolanya</p>
        <button className="primary splash-cta" onClick={start}>Mulai Sekarang <span aria-hidden="true">→</span></button>
      </section>}

      <section className="auth" aria-label="Masuk ke SehatiKan" inert={showSplash}>
        <header className="auth-header"><span className="eyebrow">Selamat datang di</span><img src="/assets/sehatikan-identity.png" alt="SehatiKan" /></header>
        <div className="intro"><span className="pill"><span className="dot" /> Teman kesehatan ikanmu</span>
          <h1>{mode === "login" ? "Selamat Datang Kembali!" : "Buat Akun SehatiKan"}</h1>
          <p>{mode === "login" ? "Masuk untuk melanjutkan konsultasi kesehatan ikanmu." : "Daftarkan dirimu untuk mulai memantau kesehatan ikan."}</p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {mode === "register" && <><label htmlFor="fullName">Nama Lengkap</label><input id="fullName" name="fullName" type="text" autoComplete="name" placeholder="Masukkan nama lengkap" required /><label htmlFor="registerType">Daftar sebagai</label><select id="registerType" value={registerType} onChange={(event)=>setRegisterType(event.target.value)}><option value="beginner">Pengguna / Pemula</option><option value="hobbyist">Penghobi Ikan</option><option value="farmer">Pembudidaya</option><option value="expert">Ahli Ikan</option></select></>}
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="Masukkan email" required />
          <div className="label-row"><label htmlFor="password">Kata Sandi</label>
            {mode === "login" && <button className="text-button" type="button" onClick={resetPassword} disabled={busy}>Lupa kata sandi?</button>}
          </div>
          <div className="password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Masukkan kata sandi" : "Buat kata sandi (min. 8 karakter)"} required />
            <button type="button" className="eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>{showPassword ? "Sembunyikan" : "Lihat"}</button>
          </div>
          {mode === "login" && <div className="remember-row"><label className="check"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Ingat saya</label><span className="secure-note">Sesi aman</span></div>}
          <p className={`feedback ${notice ? `feedback-${notice.kind}` : ""}`} role="status" aria-live="polite">{notice?.text ?? ""}</p>
          <button className="primary submit" type="submit" disabled={busy}>{busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar Sekarang"}</button>
        </form>
        <p className="switch-mode">{mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"} <button className="text-button" type="button" onClick={switchMode}>{mode === "login" ? "Daftar" : "Masuk"}</button></p>
        <footer>Dengan masuk, Anda menyetujui <a href="#">Syarat &amp; Ketentuan</a> dan <a href="#">Kebijakan Privasi</a>.</footer>
        <div className="auth-art" aria-hidden="true" />
      </section>
    </main>
  );
}
