import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getStatementById } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getStatementById(id);
  if (!s) return { title: "Carte introuvable — Opinion Cards" };
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const ogImage = s.image_url ?? undefined;
  return {
    title: `« ${s.text} » — Opinion Cards`,
    description: `${s.votes_agree + s.votes_disagree} votes · ${Math.round((s.votes_agree / Math.max(s.votes_agree + s.votes_disagree, 1)) * 100)}% d'accord. Et vous, qu'en pensez-vous ?`,
    openGraph: {
      title: `« ${s.text} »`,
      description: "Votez et découvrez si vous êtes dans la majorité !",
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `« ${s.text} »`,
      description: "Votez et découvrez si vous êtes dans la majorité !",
      images: ogImage ? [ogImage] : undefined,
    },
    // évite l'avertissement unused
    ...({} as Record<string, never>),
    other: { "og:url": `${proto}://${host}/carte/${id}` },
  };
}

export default async function CartePage({ params }: Props) {
  const { id } = await params;
  const s = await getStatementById(id);
  const total = s ? s.votes_agree + s.votes_disagree : 0;
  const agreePct = total > 0 ? Math.round(((s?.votes_agree ?? 0) / total) * 100) : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-6">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">← Voter sur cette opinion</Link>
      {!s ? (
        <p className="rounded-2xl bg-neutral-100 p-6 text-center dark:bg-neutral-900">Carte introuvable.</p>
      ) : (
        <div
          className="relative flex min-h-[60vh] flex-col justify-center overflow-hidden rounded-3xl bg-cover bg-center p-8 text-white shadow-xl"
          style={
            s.image_url
              ? { backgroundImage: `url(${s.image_url})` }
              : { background: "linear-gradient(135deg,#1e1b4b,#7c3aed 50%,#db2777)" }
          }
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 text-center">
            <p className="text-2xl font-bold leading-snug md:text-3xl">« {s.text} »</p>
            <p className="mt-6 text-lg font-semibold">{total} votes</p>
            <div className="mx-auto mt-3 flex h-3 max-w-xs overflow-hidden rounded-full">
              <div className="bg-emerald-500" style={{ width: `${agreePct}%` }} />
              <div className="bg-rose-500" style={{ width: `${100 - agreePct}%` }} />
            </div>
            <p className="mt-2 text-sm opacity-90">{agreePct}% d'accord · {100 - agreePct}% pas d'accord</p>
          </div>
        </div>
      )}
    </main>
  );
}
