import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase belum tersedia.");
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

export function supabaseErrorMessage(error: unknown, fallback: string) {
  const value = error as { code?: string; message?: string } | null;
  if (value?.code === "PGRST205" || value?.code === "42P01") {
    return "Tabel database yang dibutuhkan belum tersedia. Jalankan supabase/SETUP_SEHATIKAN.sql pada project Supabase yang sama dengan .env.local.";
  }
  if (value?.code === "PGRST204" || value?.code === "42703") {
    return "Kolom database belum diperbarui. Jalankan migrasi terbaru di Supabase SQL Editor, lalu muat ulang halaman.";
  }
  if (value?.code === "42501") return "Akun ini belum memiliki izin untuk data tersebut. Periksa role akun dan kebijakan akses Supabase.";
  return value?.message || fallback;
}
