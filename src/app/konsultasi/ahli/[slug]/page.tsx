"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { getSupabase } from "@/lib/supabase";

type Expert = { user_id:string; full_name:string; specialty:string; bio:string; qualification:string; experience_years:number|null; consultation_fee:number|null; rating:number; review_count:number; is_verified:boolean; accepting_consultations:boolean; availability:{days?:number[];slots?:string[]}; simulated?:boolean };
const sampleProfiles:Record<string,Expert>={
 "demo-rina":{user_id:"demo-rina",full_name:"Dr. Rina Maharani, S.Pi, M.Si",specialty:"Spesialis Kesehatan Ikan",bio:"Berpengalaman membantu penanganan kesehatan ikan air tawar dan koi.",qualification:"S.Pi, M.Si",experience_years:8,consultation_fee:75000,rating:4.9,review_count:124,is_verified:false,accepting_consultations:false,availability:{days:[1,2,3,4,5],slots:["09:00","11:00","14:00"]},simulated:true},
 "demo-budi":{user_id:"demo-budi",full_name:"Budi Santoso, S.Pi",specialty:"Ahli Budidaya Ikan",bio:"Fokus pada manajemen kolam, pemeliharaan, dan budidaya ikan.",qualification:"S.Pi",experience_years:6,consultation_fee:60000,rating:4.8,review_count:98,is_verified:false,accepting_consultations:false,availability:{days:[1,2,3,4,5,6],slots:["10:00","13:00","15:00"]},simulated:true},
 "demo-dewi":{user_id:"demo-dewi",full_name:"Dewi Lestari, S.Pi, M.Si",specialty:"Spesialis Penyakit Ikan",bio:"Fokus pada pengamatan gejala dan langkah awal kesehatan ikan.",qualification:"S.Pi, M.Si",experience_years:7,consultation_fee:80000,rating:4.7,review_count:76,is_verified:false,accepting_consultations:false,availability:{days:[1,2,3,4,5],slots:["09:00","11:00","14:00"]},simulated:true},
};
const weekdays = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
function Detail(){
  const {slug}=useParams<{slug:string}>(); const router=useRouter();
  const [expert,setExpert]=useState<Expert|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  useEffect(()=>{let alive=true;if(sampleProfiles[slug]){setExpert(sampleProfiles[slug]);setLoading(false);return()=>{alive=false;};}(async()=>{try{const {data,error}=await getSupabase().from("expert_profiles").select("user_id,full_name,specialty,bio,qualification,experience_years,consultation_fee,rating,review_count,is_verified,accepting_consultations,availability").eq("user_id",slug).maybeSingle();if(!alive)return;if(error)setError(error.message.includes("expert_profiles")?"Direktori ahli belum aktif. Jalankan migrasi database 005 terlebih dahulu.":error.message);else if(!data)setError("Profil ahli tidak ditemukan.");else setExpert(data as Expert);}catch(e){if(alive)setError(e instanceof Error?e.message:"Profil ahli gagal dimuat.");}finally{if(alive)setLoading(false);}})();return()=>{alive=false;}},[slug]);
  if(loading)return <><AppNav active="konsultasi"/><main className="expert-detail-page">Memuat profil ahli…</main></>;
  if(!expert)return <><AppNav active="konsultasi"/><main className="expert-detail-page"><button className="profile-back" onClick={()=>router.push("/konsultasi/ahli")}>← Kembali ke daftar ahli</button><p className="sample-note">{error}</p></main></>;
  return <><AppNav active="konsultasi"/><main className="expert-detail-page">
    <button className="profile-back" onClick={()=>router.push("/konsultasi/ahli")}>← Kembali ke daftar ahli</button>
    <section className="expert-profile-hero"><span className="expert-avatar-placeholder">{expert.full_name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}</span><div><h1>{expert.full_name}</h1><p>{expert.specialty}</p><span className={expert.simulated?"simulated-label":expert.is_verified?"expert-verified":"expert-pending"}>{expert.simulated?"PROFIL CONTOH · SIMULASI":expert.is_verified?"✓ Ahli terverifikasi":"Menunggu verifikasi"}</span></div></section>
    <section className="profile-panel expert-profile-content"><div className="expert-rating large">★ <b>{expert.review_count?expert.rating.toFixed(1):"Belum ada ulasan"}</b>{expert.review_count?` · ${expert.review_count} ulasan`:""}</div>
      <h2>Tentang Ahli</h2><p>{expert.bio||"Ahli kesehatan ikan yang siap membantu meninjau kondisi dan perawatan ikan."}</p>
      <div className="expert-facts"><div><small>Pendidikan / sertifikasi</small><strong>{expert.qualification||"Belum dicantumkan"}</strong></div><div><small>Pengalaman</small><strong>{expert.experience_years!=null?`${expert.experience_years} tahun`:"Belum dicantumkan"}</strong></div><div><small>Biaya sesi 30 menit</small><strong>{expert.consultation_fee!=null?`Rp${expert.consultation_fee.toLocaleString("id-ID")}`:"Tarif belum tersedia"}</strong></div></div>
      {expert.simulated&&<p className="sample-note">Ini profil contoh untuk pratinjau. Booking hanya tersedia untuk akun ahli aktif yang sudah terverifikasi.</p>}
      {!expert.simulated&&!expert.is_verified&&<p className="sample-note">Ahli harus terverifikasi sebelum konsultasi dapat dipesan.</p>}
      {!expert.accepting_consultations&&<p className="sample-note">Ahli sedang tidak menerima konsultasi baru.</p>}
      <button className="primary" disabled={expert.simulated||!expert.is_verified||!expert.accepting_consultations} onClick={()=>router.push(`/konsultasi/ahli/${expert.user_id}/jadwal`)}>{expert.simulated?"Contoh simulasi · tidak dapat dipesan":expert.is_verified&&expert.accepting_consultations?"Lihat jadwal & booking":"Jadwal belum tersedia"}</button>
    </section>
  </main></>;
}
export default function ExpertDetail(){return <Suspense fallback={<main className="expert-detail-page">Memuat profil ahli…</main>}><Detail/></Suspense>}
