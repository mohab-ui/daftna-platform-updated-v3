import { supabase } from "./supabase";

export type UserRole = "student" | "moderator" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", userData.user.id)
    .single();

  if (error) return null;
  return data as Profile;
}

export function isModerator(role: UserRole | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}
