import Link from "next/link";
import { CATEGORIES, type Statement } from "@/lib/types";
import { getTrending } from "@/lib/db";

export const dynamic = "force-dynamic";

function CardRow({ s, badge }: { s: Statement; badge: string }) {
    const total = s.votes_agree + s.votes_disagree;
    const agreePct = total > 0 ? Math.round((s.votes_agree / total) * 100) : 0;
    return (
      <Link
        href={`/carte/${s.id}`}
        className="block rounded-2xl border border-neutral-200 p-4 transition hover:border-black dark:border-neutral-800 dark:hover:border-white"
      >
        <p className="font-semibold">« {s.text} »</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{badge}</span>
          <span>{total} votes</span>
          <span>{agreePct}% 👍</span>
          {s.category && s.category !== "autre" && (
            <span>{CATEGORIES.find((c) => c.value === s.category)?.label}</span>
          )}
        </div>
      </Link>
    );
  }

export default async function TendancesPage() {
  const { controversial, mostVoted } = await getTrending();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Retour au flux</Link>
      <h1 className="mb-1 mt-3 text-2xl font-extrabold">🔥 Tendances</h1>
      <p className="mb-6 text-sm text-neutral-500">Les cartes qui divisent le plus, dernières 24h</p>

      <h2 className="mb-3 font-bold">⚡ Les plus controversées</h2>
      <div className="mb-8 flex flex-col gap-3">
        {controversial.length === 0 && <p className="text-sm text-neutral-500">Pas encore de données sur 24h.</p>}
        {controversial.map((s) => (
          <CardRow key={s.id} s={s} badge={`Controverse ${Math.round(s.controversy_score ?? 0)}`} />
        ))}
      </div>

      <h2 className="mb-3 font-bold">📈 Les plus votées</h2>
      <div className="flex flex-col gap-3">
        {mostVoted.map((s) => (
          <CardRow key={s.id} s={s} badge="Populaire" />
        ))}
      </div>
    </main>
  );
}
