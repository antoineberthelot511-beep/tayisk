"use client";

import { createClient } from "@supabase/supabase-js";

/** Client Supabase navigateur (clé publique, RLS active). */
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type SessionUser = { id: string; email?: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await supabaseBrowser.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email } : null;
}

export async function sendMagicLink(email: string) {
  return supabaseBrowser.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
  });
}

export async function signOut() {
  await supabaseBrowser.auth.signOut();
}
