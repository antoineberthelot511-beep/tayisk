"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeviceId } from "@/lib/device";
import { pickText, t } from "@/lib/i18n";
import { getMyStatementIds } from "@/lib/mine";
import { useLang } from "@/lib/use-lang";
import type { MyCard, ProfileData } from "@/lib/profile";
import type { Lang } from "@/lib/types";

const EMPTY: ProfileData = {
  created: [],
  stats: { total: 0, majority: 0, majorityPct: 0 },
};

export default function Profile() {
  const lang = useLang();
  const deviceId = useDeviceId();
  const [data, setData] = useState<ProfileData | null>(null);
  const copy = t(lang);

  useEffect(() => {
    // Le device et les cartes creees ne sont lisibles qu'apres hydratation.
    if (!deviceId) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      device: deviceId,
      ids: getMyStatementIds().join(","),
    });

    fetch(`/api/mine?${query}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: ProfileData) => setData(json))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("[profil]", error);
        setData(EMPTY);
      });

    return () => controller.abort();
  }, [deviceId]);

  const stats = data?.stats;

  return (
    <div className="flex flex-1 flex-col gap-7 overflow-y-auto pb-4">
      <section className="grid grid-cols-2 gap-3">
        <Stat
          value={stats ? String(stats.total) : "—"}
          label={copy.myVotes}
          accent="text-paper"
        />
        <Stat
          value={stats && stats.total > 0 ? `${stats.majorityPct}%` : "—"}
          label={copy.inMajority}
          accent="text-agree"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow text-paper/40">
          {copy.myCards}
          {data ? ` (${data.created.length})` : ""}
        </h2>

        {data === null && <p className="text-sm text-paper/35">…</p>}

        {data?.created.length === 0 && (
          <div className="rounded-2xl border border-paper/12 px-5 py-7 text-center">
            <p className="text-sm text-paper/50">{copy.noCards}</p>
            <Link
              href="/creer"
              className="eyebrow mt-4 inline-block rounded-full bg-agree px-5 py-3 text-ink"
            >
              {copy.create}
            </Link>
          </div>
        )}

        {data?.created.map((card) => (
          <CardRow key={card.id} card={card} lang={lang} />
        ))}
      </section>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-paper/12 px-5 py-4">
      <p className={`font-display text-4xl leading-none ${accent}`}>{value}</p>
      <p className="eyebrow mt-2 text-paper/40">{label}</p>
    </div>
  );
}

function CardRow({ card, lang }: { card: MyCard; lang: Lang }) {
  const copy = t(lang);
  const total = card.votes_agree + card.votes_disagree;
  const agreePct = total === 0 ? 50 : Math.round((card.votes_agree / total) * 100);

  return (
    <article className="flex gap-4 rounded-2xl border border-paper/12 p-3">
      <div
        className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-2 bg-cover bg-center"
        style={
          card.image_url ? { backgroundImage: `url(${card.image_url})` } : undefined
        }
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <p className="font-display text-lg leading-snug text-balance">
          {pickText(card, lang)}
        </p>

        {card.status === "approved" ? (
          <div className="mt-2">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-paper/12">
              <div className="bg-agree" style={{ width: `${agreePct}%` }} />
              <div className="flex-1 bg-disagree" />
            </div>
            <p className="eyebrow mt-2 text-paper/40">
              {copy.votes(total)} · {agreePct}% {copy.agree.toLowerCase()}
            </p>
          </div>
        ) : (
          <p
            className={`eyebrow mt-2 ${
              card.status === "rejected" ? "text-disagree" : "text-paper/40"
            }`}
          >
            {card.status === "rejected" ? copy.statusRejected : copy.statusPending}
          </p>
        )}
      </div>
    </article>
  );
}
