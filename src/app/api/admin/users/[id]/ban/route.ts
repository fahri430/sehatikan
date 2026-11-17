import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!anon||!service)return NextResponse.json({error:"SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server."},{status:503});
 const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");if(!token)return NextResponse.json({error:"Login diperlukan."},{status:401});
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user:actor}}=await auth.auth.getUser(token);
 if(!actor||actor.app_metadata?.role!=="admin")return NextResponse.json({error:"Akses admin diperlukan."},{status:403});
 const {id}=await params;if(id===actor.id)return NextResponse.json({error:"Admin tidak dapat membekukan akun sendiri."},{status:400});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});const {data:target}=await admin.auth.admin.getUserById(id);
 if(!target.user)return NextResponse.json({error:"Akun tidak ditemukan."},{status:404});if(target.user.app_metadata?.role==="admin")return NextResponse.json({error:"Akun admin lain tidak dapat dibekukan dari panel ini."},{status:403});
 const body=await request.json().catch(()=>({}));const banned=body?.banned===true;const {error}=await admin.auth.admin.updateUserById(id,{ban_duration:banned?"876000h":"none"});if(error)return NextResponse.json({error:error.message},{status:500});
 await admin.from("profiles").update({is_banned:banned}).eq("id",id);return NextResponse.json({ok:true,banned});
}
