"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/auth-client";
import { CATEGORIES, type StatementStatus } from "@/lib/types";

interface AdminStatement {
  id: string;
  text: string;
  status: StatementStatus;
  category: string | null;
  votes_agree: number;
  votes_disagree: number;
  created_at: string;
}

const STATUS_BADGE: Record<StatementStatus, string> = {
  approved: "✅ publiée",
  pending: "⏳ en attente",
  rejected: "❌ rejetée",
};

export default function AdminModerationPage() {
  const [items, setItems] = useState<AdminStatement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const session = (await supabaseBrowser.auth.getSession()).data.session;
    if (!session) {
      setError("Connectez-vous avec un compte administrateur (via la page Profil).");
      setLoading(false);
      return;
    }
    const res = await fetch("/api/admin/statements", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    if (!res.ok) setError(json.error);
    else setItems(json.statements ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: string, status: "approved" | "rejected") {
    const session = (await supabaseBrowser.auth.getSession()).data.session;
    if (!session) return;
    await fetch("/api/admin/statements", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Retour au flux</Link>
      <h1 className="mb-1 mt-3 text-2xl font-extrabold">🛡️ Modération</h1>
      <p className="mb-6 text-sm text-neutral-500">Vérifiez les cartes récentes et masquez celles qui posent problème.</p>

      {error && (
        <p className="rounded-xl bg-red-100 p-4 text-sm text-red-800">
          {error} <Link href="/profil" className="underline">Se connecter</Link>
        </p>
      )}
      {loading && <p className="text-neutral-500">Chargement…</p>}

      <div className="flex flex-col gap-3">
        {items.map((s) => (
          <div key={s.id} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">« {s.text} »</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {STATUS_BADGE[s.status]} · {CATEGORIES.find((c) => c.value === s.category)?.label ?? "Autre"} ·{" "}
                  {s.votes_agree + s.votes_disagree} votes · {new Date(s.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {s.status !== "rejected" && (
                  <button onClick={() => moderate(s.id, "rejected")}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500">
                    Masquer
                  </button>
                )}
                {s.status !== "approved" && (
                  <button onClick={() => moderate(s.id, "approved")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                    Approuver
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
