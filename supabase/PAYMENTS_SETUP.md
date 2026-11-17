# Menyalakan pembayaran konsultasi

Checkout menggunakan Midtrans Snap. Kode pembayaran sudah berada di server route; pembayaran belum dapat hidup sampai project memakai environment variable dan webhook yang valid.

1. Terapkan `supabase/SETUP_SEHATIKAN.sql` pada project Supabase yang benar (migrasi 001–009).
2. Buat/aktifkan akun merchant Midtrans. Mulai dengan Sandbox untuk uji coba.
3. Tambahkan environment variable server:
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, jangan gunakan awalan `NEXT_PUBLIC_`)
   - `MIDTRANS_SERVER_KEY`
   - `MIDTRANS_IS_PRODUCTION=false` untuk sandbox; ubah menjadi `true` hanya untuk akun produksi.
   - `NEXT_PUBLIC_APP_URL` sesuai URL aplikasi.
4. Di dashboard Midtrans, set HTTP Notification URL menjadi `https://<domain-aplikasi>/api/payments/midtrans/webhook`.
5. Restart aplikasi. Transaksi baru dibuat lewat `/pembayaran/[id]`; sesi hanya aktif setelah webhook terverifikasi. Uji Sandbox dengan kredensial Sandbox dan webhook yang dapat diakses dari internet, lalu ganti ke kunci produksi hanya setelah pengujian selesai.

Jika checkout menampilkan konfigurasi belum tersedia, pastikan semua variable di atas dipasang pada environment server yang menjalankan Next.js (bukan hanya `.env.local` saat deploy), lalu redeploy/restart. Jangan mengirim `SUPABASE_SERVICE_ROLE_KEY` atau `MIDTRANS_SERVER_KEY` ke browser maupun chat.

Midtrans memotong biaya per transaksi berhasil sesuai metode bayar. Tidak ada biaya implementasi/maintenance, tetapi transaksi tidak gratis. Tarif ahli dibayarkan melalui checkout; aplikasi ini tidak menyimpan saldo GoPay/DANA seperti dompet elektronik dan belum melakukan payout otomatis ke rekening ahli. Pencairan ahli memerlukan fitur disbursement merchant yang disetujui/diaktifkan dan detail rekening ahli. Jangan menandai transaksi lunas secara manual.
