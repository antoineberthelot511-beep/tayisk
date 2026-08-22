"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";
import ShareButton from "./ShareButton";
import { pickText, t } from "@/lib/i18n";
import type { FeedStatement, Lang, VoteChoice } from "@/lib/types";

const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 480;

/** Teinte stable derivee de l'id : sert de fond quand la carte n'a pas d'image. */
function hueFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export default function VoteCard({
  statement,
  lang,
  onVote,
  locked = false,
  children,
}: {
  statement: FeedStatement;
  lang: Lang;
  onVote?: (vote: VoteChoice) => void;
  locked?: boolean;
  children?: ReactNode;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-11, 0, 11]);
  const agreeStamp = useTransform(x, [30, 130], [0, 1]);
  const disagreeStamp = useTransform(x, [-130, -30], [1, 0]);
  const glowAgree = useTransform(x, [0, 180], [0, 0.85]);
  const glowDisagree = useTransform(x, [-180, 0], [0.85, 0]);

  const draggable = Boolean(onVote) && !locked;
  const hue = hueFrom(statement.id);
  const total = statement.votes_agree + statement.votes_disagree;
  const copy = t(lang);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const passed =
      Math.abs(info.offset.x) > SWIPE_DISTANCE ||
      Math.abs(info.velocity.x) > SWIPE_VELOCITY;
    if (!passed) return;
    onVote?.(info.offset.x > 0 ? "agree" : "disagree");
  }

  return (
    <motion.article
      className="no-select absolute inset-0 overflow-hidden rounded-[28px] bg-ink-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      style={{ x, rotate, touchAction: draggable ? "pan-y" : "auto" }}
      drag={draggable ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.5}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={draggable ? handleDragEnd : undefined}
      whileTap={draggable ? { cursor: "grabbing" } : undefined}
    >
      {/* Fond : photo, ou degrade colore stable si l'API image n'a rien donne */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 25% 15%, hsl(${hue} 62% 34%), hsl(${(hue + 48) % 360} 55% 12%))`,
        }}
      />
      {statement.image_url && (
        // Image distante non optimisee : les URLs viennent d'une API tierce et
        // sont deja mises en cache en base, next/image n'apporterait rien ici.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={statement.image_url}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="scrim absolute inset-0" />

      {/* Halo colore pendant le swipe */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[28px] ring-4 ring-agree ring-inset"
        style={{ opacity: glowAgree }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[28px] ring-4 ring-disagree ring-inset"
        style={{ opacity: glowDisagree }}
      />

      {/* Tampons facon coup de tampon encreur */}
      <motion.div
        className="pointer-events-none absolute top-8 left-6 -rotate-12 rounded-lg border-[3px] border-agree px-3 py-1.5"
        style={{ opacity: agreeStamp }}
      >
        <span className="eyebrow text-agree">{copy.agree}</span>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute top-8 right-6 rotate-12 rounded-lg border-[3px] border-disagree px-3 py-1.5"
        style={{ opacity: disagreeStamp }}
      >
        <span className="eyebrow text-disagree">{copy.disagree}</span>
      </motion.div>

      {/* Enonce */}
      <div className="relative flex h-full flex-col justify-end p-7 pb-9">
        {/* Guillemet decoratif : ancre la composition quand la carte n'a pas
            d'image et que le haut resterait vide */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-6 font-display text-[7rem] leading-none text-paper/12"
        >
          &ldquo;
        </span>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="eyebrow text-paper/45">
            {total > 0 ? copy.votes(total) : copy.newCard}
          </p>
          <ShareButton statement={statement} lang={lang} variant="icon" />
        </div>
        <h2
          className="font-display text-[clamp(1.9rem,7.2vw,2.9rem)] leading-[1.06] text-balance text-paper"
          lang={lang}
        >
          {pickText(statement, lang)}
        </h2>
      </div>

      {children}
    </motion.article>
  );
}
