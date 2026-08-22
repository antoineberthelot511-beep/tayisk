import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Vrai si les variables Supabase sont presentes. Quand c'est faux, l'app
 * bascule sur les donnees de demo (lib/demo-data.ts) au lieu de planter.
 */
export const isSupabaseConfigured = Boolean(url && serviceKey);

let cached: SupabaseClient | null = null;

/**
 * Client serveur (service role) : contourne RLS, ne doit jamais etre
 * importe depuis un composant client.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error("Supabase non configure (voir .env.local)");
  }
  cached ??= createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
