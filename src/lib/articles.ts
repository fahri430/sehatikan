export type Article = {
  slug: string;
  title: string;
  category: "Kesehatan ikan" | "Kualitas Air" | "Perawatan";
  date: string;
  image: string;
  position: string;
  excerpt: string;
  paragraphs: string[];
};

export const articles: Article[] = [
  {
    slug: "mencegah-penyakit-koi",
    title: "Cara Mencegah Penyakit pada Ikan Koi",
    category: "Kesehatan ikan",
    date: "12 Oktober 2026",
    image: "/assets/beranda-underwater.png",
    position: "center 34%",
    excerpt: "Kebiasaan sederhana untuk membantu menjaga koi tetap sehat dan aktif.",
    paragraphs: [
      "Pencegahan dimulai dari pengamatan rutin. Perhatikan perubahan nafsu makan, cara berenang, warna tubuh, dan interaksi ikan setiap hari.",
      "Jaga kualitas air tetap stabil, hindari perubahan suhu yang mendadak, dan jangan memberi pakan berlebihan. Sisa pakan dapat menurunkan kualitas air.",
      "Jika ada ikan yang tampak sakit, pisahkan bila memungkinkan dan catat gejalanya. Artikel ini adalah informasi umum, bukan diagnosis. Hubungi ahli kesehatan ikan untuk penanganan lebih lanjut.",
    ],
  },
  {
    slug: "kualitas-air-budidaya",
    title: "Pentingnya Kualitas Air yang Baik untuk Budidaya Ikan",
    category: "Kualitas Air",
    date: "11 Oktober 2026",
    image: "/assets/beranda-underwater.png",
    position: "center 72%",
    excerpt: "Kenali parameter dasar air dan cara memantaunya secara teratur.",
    paragraphs: [
      "Kualitas air berpengaruh pada kenyamanan, pertumbuhan, dan kesehatan ikan. Perubahan yang terlihat kecil pun dapat membuat ikan stres.",
      "Catat suhu dan pH secara berkala, amati kejernihan air, serta pastikan sirkulasi dan aerasi bekerja baik. Kebutuhan ideal dapat berbeda menurut jenis ikan.",
      "Lakukan perubahan air secara bertahap dan hindari mengganti seluruh air sekaligus tanpa alasan yang tepat. Gunakan alat ukur yang sesuai dan konsultasikan hasil yang mengkhawatirkan kepada ahli.",
    ],
  },
  {
    slug: "gejala-infeksi-ikan",
    title: "Mengenal Gejala dan Penanganan Infeksi pada Ikan",
    category: "Kesehatan ikan",
    date: "9 Oktober 2026",
    image: "/assets/splash-underwater.png",
    position: "center 46%",
    excerpt: "Tanda yang bisa diamati dan langkah awal yang aman saat ikan berubah kondisi.",
    paragraphs: [
      "Tanda gangguan kesehatan dapat berupa ikan kurang aktif, nafsu makan berubah, bercak pada tubuh, atau berenang tidak seperti biasanya. Gejala tersebut belum tentu menunjukkan satu penyakit tertentu.",
      "Catat kapan perubahan mulai terlihat, jumlah ikan yang terdampak, serta kondisi air. Foto yang jelas dapat membantu ahli memahami situasi.",
      "Hindari memberikan obat tanpa mengetahui penyebab dan dosisnya. Untuk gejala yang memburuk, mintalah saran tenaga ahli kesehatan ikan.",
    ],
  },
  {
    slug: "jadwal-perawatan-kolam",
    title: "Membuat Jadwal Perawatan Kolam yang Konsisten",
    category: "Perawatan",
    date: "7 Oktober 2026",
    image: "/assets/beranda-underwater.png",
    position: "center 60%",
    excerpt: "Susun rutinitas pakan, pemeriksaan air, dan kebersihan kolam dengan praktis.",
    paragraphs: [
      "Jadwal sederhana membantu perawatan dilakukan konsisten. Mulailah dengan tugas rutin yang penting: memberi pakan, mengecek kondisi ikan, dan memantau air.",
      "Atur frekuensi sesuai jenis ikan, ukuran kolam, sistem filtrasi, dan arahan ahli. Simpan catatan singkat agar perubahan kondisi lebih mudah diketahui.",
      "Evaluasi jadwal secara berkala. Rutinitas yang tepat adalah yang sesuai kebutuhan kolam dan dapat dilakukan dengan aman.",
    ],
  },
];
