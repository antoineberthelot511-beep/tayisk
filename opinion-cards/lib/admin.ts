import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "./db";

/**
 * Vérifie que le JWT appartient à un utilisateur avec profiles.is_admin = true.
 * Le token est validé par Supabase Auth (signature), pas seulement décodé.
 */
export async function getAdminUser(accessToken: string): Promise<{ id: string } | null> {
  try {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false },
      }
    );
    const { data, error } = await anon.auth.getUser(accessToken);
    if (error || !data.user) return null;
    const { data: prof } = await getSupabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();
    return prof?.is_admin ? { id: data.user.id } : null;
  } catch {
    return null;
  }
}
