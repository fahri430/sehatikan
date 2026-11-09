# SehatiKan

Web awal SehatiKan menggunakan Next.js App Router, TypeScript, dan Supabase Auth dengan PostgreSQL.

## Menjalankan di komputer lokal

1. Instal Node.js versi LTS 20.9 atau lebih baru.
2. Jalankan `npm install`.
3. Buat project Supabase, lalu salin `.env.example` menjadi `.env.local`.
4. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari pengaturan API project Supabase. Gunakan publishable key; jangan masukkan secret/service-role key ke aplikasi web.
5. Jalankan SQL secara berurutan dari folder `supabase/migrations` melalui Supabase SQL Editor. Migrasi 003 mendaftarkan profil ahli di direktori; migrasi 004 mengaktifkan sesi konsultasi, kebijakan akses, serta pesan Realtime.
6. Pada Supabase Auth, atur Site URL ke alamat aplikasi lokal dan tambahkan `/reset-password` ke daftar Redirect URLs.
7. Jalankan `npm run dev`, lalu buka alamat localhost yang ditampilkan.

Form masuk, pendaftaran email, dan pemulihan kata sandi memakai Supabase Auth. Ahli baru otomatis masuk ke direktori setelah migrasi 003 dijalankan. Akun ahli perlu ditandai terverifikasi di database sebelum dapat menerima konsultasi. Migrasi 004 menyediakan chat antar pengguna dan ahli melalui Supabase Realtime. Jalankan migrasi yang belum diterapkan di Supabase SQL Editor; jangan memasukkan secret/service-role key ke aplikasi.
