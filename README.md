# SehatiKan

Web awal SehatiKan menggunakan Next.js App Router, TypeScript, dan Supabase Auth dengan PostgreSQL.

## Menjalankan di komputer lokal

1. Instal Node.js versi LTS 20.9 atau lebih baru.
2. Jalankan `npm install`.
3. Buat project Supabase, lalu salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari pengaturan API project Supabase. Gunakan publishable key; jangan masukkan secret/service-role key ke aplikasi web.
5. Pastikan project yang dibuka di dashboard memiliki Project URL yang sama persis dengan `NEXT_PUBLIC_SUPABASE_URL` pada `.env.local`. Untuk setup database sekaligus, jalankan `supabase/SETUP_SEHATIKAN.sql` melalui Supabase SQL Editor. File ini menjalankan migrasi 001–010 dan aman dijalankan ulang.
6. Pada Supabase Auth, atur Site URL ke alamat aplikasi lokal dan tambahkan `/reset-password` ke daftar Redirect URLs.
7. Jalankan `npm run dev`, lalu buka alamat localhost yang ditampilkan.

Form masuk, pendaftaran email, dan pemulihan kata sandi memakai Supabase Auth. Migrasi 005 membuat profil direktori ahli, migrasi 008 menambahkan pilihan waktu pembayaran dan penutupan sesi, migrasi 009 memperbaiki relasi komentar serta membatasi penerima notifikasi, dan migrasi 010 memperbaiki tabel penyakit serta mengizinkan ahli mengajukan artikel untuk moderasi admin. Artikel hanya tampil untuk semua peran setelah diterbitkan admin. Akun ahli baru berstatus menunggu verifikasi dan baru dapat menerima booking setelah pemeriksaan administrator. Migrasi 004 menyediakan chat antar pengguna dan ahli melalui Supabase Realtime. Jika project sudah memakai skema lama, jalankan `supabase/SETUP_SEHATIKAN.sql` lagi atau terapkan migrasi yang belum diterapkan secara berurutan; jangan memasukkan secret/service-role key ke aplikasi.

Untuk memverifikasi ahli setelah memeriksa kualifikasinya, administrator dapat menjalankan perintah berikut di SQL Editor (ganti email akun ahli):

```sql
update public.expert_profiles e
set is_verified = true, updated_at = now()
from auth.users u
where u.id = e.user_id and lower(u.email) = lower('email-ahli@example.com');
```

## Menjalankan Bot AI lokal tanpa biaya API

Untuk pengembangan di Windows, setelah llama.cpp tersedia, jalankan server lokal dari PowerShell (perintah ini cocok dengan binary terpasang di komputer pengembang):

```powershell
& "$env:LOCALAPPDATA\SehatiKan\llama.cpp\b12242\llama-server.exe" -m "$env:LOCALAPPDATA\SehatiKan\models\Qwen3-VL-2B\Qwen3VL-2B-Instruct-Q4_K_M.gguf" --mmproj "$env:LOCALAPPDATA\SehatiKan\models\Qwen3-VL-2B\mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf" --host 127.0.0.1 --port 9931 --no-webui -c 4096 --no-mmproj-offload
```

Tunggu sampai model selesai diunduh dan status server siap. Model vision mengunduh bobot model dan image projector pertama kali (sekitar 1,6 GB). Biarkan terminal ini tetap terbuka. Di terminal kedua, jalankan aplikasi dengan `npm run dev`, lalu buka halaman **Konsultasi Bot AI**. Chat dan percakapan tersimpan di Supabase; foto privat disimpan di bucket Supabase dan dikirim ke model lokal untuk dianalisis. Komputer harus menyala selama AI dipakai; tidak perlu VPS atau API berbayar untuk pengembangan lokal. Model memerlukan RAM dan CPU, dan jawabannya bisa keliru.
