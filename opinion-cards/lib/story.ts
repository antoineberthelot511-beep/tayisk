import { pickText } from "./i18n";
import type { FeedStatement, Lang, VoteChoice } from "./types";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

const MARGIN = 96;
const PAPER = "#f4efe4";
const AGREE = "#c9f31d";
const DISAGREE = "#ff3b5c";

/** Famille de police reelle generee par next/font, lisible via la variable CSS. */
function displayFont(): string {
  if (typeof window === "undefined") return "Georgia, serif";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-serif")
    .trim();
  return value ? `${value}, Georgia, serif` : "Georgia, serif";
}

function uiFont(): string {
  if (typeof window === "undefined") return "sans-serif";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-grotesk")
    .trim();
  return value ? `${value}, sans-serif` : "sans-serif";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Indispensable pour que le canvas reste exportable : sans ca, dessiner
    // une image distante le "taint" et toBlob echoue.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Decoupe le texte en lignes qui tiennent dans `maxWidth`. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Dessine l'image en mode "cover" : remplit le cadre sans deformer. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function hueFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export type StoryResult = {
  agreePct: number;
  vote: VoteChoice;
  isMajority: boolean;
  caption: string;
};

/**
 * Compose la story 9:16 sur un canvas et renvoie le PNG.
 * Reprend la mise en page de la carte : photo, voile sombre, enonce en bas.
 */
export async function renderStory(
  statement: FeedStatement,
  lang: Lang,
  result?: StoryResult,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  const display = displayFont();
  const ui = uiFont();

  // Les polices doivent etre pretes avant toute mesure de texte.
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`400 92px ${display}`),
      document.fonts.load(`600 26px ${ui}`),
    ]);
    await document.fonts.ready;
  }

  // Fond : degre colore stable, puis photo si elle est disponible
  const hue = hueFrom(statement.id);
  const base = ctx.createLinearGradient(0, 0, STORY_WIDTH, STORY_HEIGHT);
  base.addColorStop(0, `hsl(${hue} 62% 30%)`);
  base.addColorStop(1, `hsl(${(hue + 48) % 360} 55% 10%)`);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  if (statement.image_url) {
    const img = await loadImage(statement.image_url);
    if (img) drawCover(ctx, img, STORY_WIDTH, STORY_HEIGHT);
  }

  const scrim = ctx.createLinearGradient(0, 0, 0, STORY_HEIGHT);
  scrim.addColorStop(0, "rgba(11,11,16,0.45)");
  scrim.addColorStop(0.4, "rgba(11,11,16,0.55)");
  scrim.addColorStop(0.75, "rgba(11,11,16,0.9)");
  scrim.addColorStop(1, "rgba(11,11,16,0.97)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Guillemet decoratif
  ctx.fillStyle = "rgba(244,239,228,0.2)";
  ctx.font = `400 320px ${display}`;
  ctx.textBaseline = "top";
  ctx.fillText("“", MARGIN - 12, MARGIN - 40);

  // Bloc du bas : on empile depuis le bas vers le haut
  let y = STORY_HEIGHT - MARGIN;

  // Signature
  ctx.font = `600 26px ${ui}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(244,239,228,0.45)";
  ctx.letterSpacing = "4px";
  ctx.fillText("OPINION CARDS", MARGIN, y);
  ctx.letterSpacing = "0px";
  y -= 96;

  // Resultat du vote, si la story est partagee apres avoir vote
  if (result) {
    const barWidth = STORY_WIDTH - MARGIN * 2;
    const barY = y - 18;
    const agreeWidth = Math.round((barWidth * result.agreePct) / 100);

    ctx.fillStyle = DISAGREE;
    ctx.beginPath();
    ctx.roundRect(MARGIN, barY, barWidth, 14, 7);
    ctx.fill();

    ctx.fillStyle = AGREE;
    ctx.beginPath();
    ctx.roundRect(MARGIN, barY, Math.max(14, agreeWidth), 14, 7);
    ctx.fill();

    y = barY - 44;
    ctx.font = `400 56px ${display}`;
    ctx.fillStyle = result.vote === "agree" ? AGREE : DISAGREE;
    ctx.fillText(result.caption, MARGIN, y);
    y -= 104;
  }

  // Enonce, remonte ligne par ligne
  const fontSize = 92;
  const lineHeight = fontSize * 1.12;
  ctx.font = `400 ${fontSize}px ${display}`;
  ctx.fillStyle = PAPER;

  const lines = wrapLines(ctx, pickText(statement, lang), STORY_WIDTH - MARGIN * 2);
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], MARGIN, y);
    y -= lineHeight;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Export PNG impossible")),
      "image/png",
    );
  });
}
