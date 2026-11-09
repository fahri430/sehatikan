"use client";
import { ReactNode,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
export default function ExpertLayout({children}:{children:ReactNode}){const router=useRouter();const [ready,setReady]=useState(false);useEffect(()=>{const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key){setReady(true);return;}createClient(url,key).auth.getSession().then(({data})=>{if(!data.session){router.replace("/");return;}if(data.session.user.user_metadata?.user_type!=="expert"){router.replace("/beranda");return;}setReady(true);});},[router]);return ready?children:<main className="expert-dashboard"><p>Memeriksa akses ahli…</p></main>;}
