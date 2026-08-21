"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";

const W = 1080;
const H = 1920;

export default function ShareButton({ text, imageUrl }: { text: string; imageUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  async function generatePng(): Promise<Blob> {
    const node = canvasRef.current!;
    const dataUrl = await toPng(node, { width: W, height: H, pixelRatio: 1, cacheBust: true });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await generatePng();
      const file = new File([blob], "opinion-card.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      // Le partage de fichiers ne fonctionne qu'avec des apps natives (mobile).
      // Sur desktop, les "apps" Snapchat/Instagram sont des PWAs web qui
      // renvoient une erreur ("Cannot POST /web/_share-target") → on télécharge.
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
      const canShareFiles = isMobile && nav.canShare?.({ files: [file] }) && nav.share;

      if (canShareFiles) {
        try {
          await nav.share!({ files: [file], title: "Opinion Cards", text });
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return; // utilisateur a annulé
          // sinon : on retombe sur le téléchargement
        }
      }

      // Fallback : téléchargement direct du PNG
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opinion-card.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* erreur de génération */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Canvas hors écran au format story 9:16 */}
      <div
        ref={canvasRef}
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: imageUrl ? `url(${imageUrl}) center/cover` : "linear-gradient(135deg,#1e1b4b,#7c3aed 50%,#db2777)",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          padding: 120,
          textAlign: "center",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
        <p style={{ position: "relative", fontSize: 72, fontWeight: 700, lineHeight: 1.3 }}>« {text} »</p>
        <p style={{ position: "absolute", bottom: 100, fontSize: 36, opacity: 0.8 }}>Opinion Cards</p>
      </div>

      <button
        onClick={share}
        disabled={busy}
        className="rounded-full bg-white/20 px-4 py-2 font-medium backdrop-blur transition hover:bg-white/30 disabled:opacity-50"
      >
        {busy ? "Génération…" : "📤 Partager en story"}
      </button>
    </>
  );
}
