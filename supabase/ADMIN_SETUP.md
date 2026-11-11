# Menyiapkan akun Admin SehatiKan

Admin memakai Supabase Auth dengan role tepercaya di `app_metadata`. Akun biasa tidak dapat memberikan role admin ke dirinya sendiri.

1. Jalankan `SETUP_SEHATIKAN.sql` di SQL Editor pada project Supabase yang URL-nya sama dengan `.env.local`.
2. Buka **Authentication → Users → Add user**. Buat akun admin dengan email yang Anda kuasai dan kata sandi kuat. Simpan kata sandi di password manager.
3. Jalankan query berikut di SQL Editor, ganti email dengan email admin yang baru dibuat:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('admin@domain-anda.id');
```

4. Pastikan query memengaruhi tepat satu baris. Keluar lalu masuk ulang melalui `/login-admin` agar token memuat role terbaru.

Dashboard admin tersedia di `/admin`. Fitur yang tersedia: ringkasan statistik, verifikasi ahli, tambah/edit/hapus basis data penyakit, serta preferensi admin yang tersimpan lokal pada browser admin.

Jangan menaruh `service_role` key di browser, `.env` berawalan `NEXT_PUBLIC_`, atau membagikannya. Jangan menaruh kata sandi admin di source code.
