"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessionUser, sendMagicLink, signOut, supabaseBrowser, type SessionUser } from "@/lib/auth-client";
import { CATEGORIES, type Statement } from "@/lib/types";

interface MyCard {
  id: string;
  text: string;
  votes_agree: number;
  votes_disagree: number;
  category: string | null;
  status: string;
}

interface VoteRow {
  id: string;
  vote: "agree" | "disagree";
  created_at: string;
  statements: { id: string; text: string } | null;
}

export default function ProfilPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [history, setHistory] = useState<VoteRow[]>([]);
  const [streak, setStreak] = useState(0);

  async function loadAll(uid: string) {
    const { data: cards } = await supabaseBrowser
      .from("statements")
      .select("id,text,votes_agree,votes_disagree,category,status")
      .eq("created_by", uid)
      .order("created_at", { ascending: false })
      .limit(50);
    setMyCards((cards ?? []) as MyCard[]);
    const { data: votes } = await supabaseBrowser
      .from("votes")
      .select("id,vote,created_at,statements(id,text)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((votes ?? []) as unknown as VoteRow[]);
    const { data: prof } = await supabaseBrowser.from("profiles").select("streak_count").eq("id", uid).maybeSingle();
    setStreak(prof?.streak_count ?? 0);
  }

  useEffect(() => {
    getSessionUser().then(async (u) => {
      setUser(u);
      if (u) await loadAll(u.id);
      setReady(true);
    });
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email } : null);
      if (u) loadAll(u.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <main className="p-8 text-center text-neutral-500">Chargement…</main>;

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">← Retour au flux</Link>
        <h1 className="mb-4 mt-3 text-2xl font-extrabold">Mon profil</h1>
        {sent ? (
          <p className="rounded-xl bg-emerald-100 p-4 text-emerald-800">
            📧 Lien de connexion envoyé à {email}. Ouvrez-le sur cet appareil pour vous connecter.
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await sendMagicLink(email);
              if (!error) setSent(true);
              else alert(error.message);
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-neutral-500">Connectez-vous par e-mail (sans mot de passe) pour suivre vos cartes et votre série de votes.</p>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com"
              className="rounded-xl border border-neutral-300 p-3 dark:border-neutral-700 dark:bg-neutral-900" />
            <button className="rounded-xl bg-black py-3 font-semibold text-white dark:bg-white dark:text-black">
              Recevoir le lien magique
            </button>
          </form>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">← Retour au flux</Link>
        <button onClick={() => signOut()} className="text-sm text-neutral-500 hover:underline">Déconnexion</button>
      </div>
      <h1 className="text-2xl font-extrabold">Mon profil</h1>
      <p className="text-sm text-neutral-500">{user.email}</p>

      <div className="my-5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-5 text-white">
        <p className="text-sm opacity-80">Série de votes</p>
        <p className="text-3xl font-extrabold">🔥 {streak} jour{streak > 1 ? "s" : ""} d'affilée</p>
      </div>

      <h2 className="mb-2 font-bold">Mes cartes ({myCards.length})</h2>
      <div className="mb-6 flex flex-col gap-2">
        {myCards.length === 0 && <p className="text-sm text-neutral-500">Aucune carte créée. <Link href="/create" className="underline">Créez la première !</Link></p>}
        {myCards.map((c) => {
          const total = c.votes_agree + c.votes_disagree;
          return (
            <Link key={c.id} href={`/carte/${c.id}`} className="block rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <p className="font-medium">« {c.text} »</p>
              <p className="mt-1 text-xs text-neutral-500">
                {total} votes · {total > 0 ? Math.round((c.votes_agree / total) * 100) : 0}% 👍 ·{" "}
                {CATEGORIES.find((cat) => cat.value === c.category)?.label ?? "Autre"} ·{" "}
                {c.status === "approved" ? "✅ publiée" : c.status === "pending" ? "⏳ en attente" : "❌ rejetée"}
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-2 font-bold">Mes derniers votes</h2>
      <div className="flex flex-col gap-2">
        {history.length === 0 && <p className="text-sm text-neutral-500">Aucun vote enregistré avec ce compte.</p>}
        {history.map((v) => (
          <div key={v.id} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
            <span>{v.vote === "agree" ? "👍" : "👎"}</span>
            <span className="flex-1 truncate">{v.statements?.text ?? "Carte supprimée"}</span>
            <span className="text-xs text-neutral-400">{new Date(v.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

