import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

const adminKinds = ["user_report"] as const;
const expertKinds = ["consultation_request", "chat_reply", "payment_status", "expert_verification", "expert_status", "expert_review"] as const;
const userKinds = ["chat_reply", "consultation_status", "payment_status", "payment_due"] as const;

export async function notificationKindsForUser(user: User) {
  if (user.app_metadata?.role === "admin") return [...adminKinds];
  const { data: profile, error } = await getSupabase().from("profiles").select("user_type").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return profile?.user_type === "expert" ? [...expertKinds] : [...userKinds];
}
