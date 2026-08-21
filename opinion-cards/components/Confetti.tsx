"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const COLORS = ["#f43f5e", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6"];

/**
 * Micro-particules discrètes — uniquement pour les consensus extrêmes (<5% ou >95%).
 * Animations transform/opacity uniquement (60fps), respecte prefers-reduced-motion.
 */
export default function Confetti({ reduced }: { reduced: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 320,
        y: -(120 + Math.random() * 220),
        rot: Math.random() * 360,
        delay: Math.random() * 0.25,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    []
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 block rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.x, y: p.y + 200, rotate: p.rot, scale: 0.5 }}
          transition={{ duration: 1.4 + Math.random() * 0.6, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
