import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import {
  foldWord,
  GOLD,
  layoutTitleLines,
  measureImpactLine,
  WHITE,
} from "@/lib/creative/layout";

export const CREATIVE_WIDTH = 1080;
export const CREATIVE_HEIGHT = 1440;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assetPath(...parts: string[]): string {
  return path.join(process.cwd(), "public", ...parts);
}

async function fileToDataUri(
  filePath: string,
  mime: string,
): Promise<string> {
  const buf = await readFile(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function pickFontSize(lines: string[]): number {
  const maxLine = Math.max(...lines.map((l) => measureImpactLine(l, 100)), 1);
  // Largeur utile ~ 960px
  const byWidth = (960 / maxLine) * 100;
  return Math.max(42, Math.min(78, Math.floor(byWidth)));
}

function renderLineSpans(line: string, highlightSet: Set<string>): string {
  const words = line.split(/\s+/).filter(Boolean);
  return words
    .map((word, i) => {
      const folded = foldWord(word);
      const gold = highlightSet.has(folded);
      const fill = gold ? GOLD : WHITE;
      const space = i < words.length - 1 ? " " : "";
      return `<tspan fill="${fill}">${escapeXml(word)}${space}</tspan>`;
    })
    .join("");
}

/**
 * Monte une créative Rempart 1080×1440 (DA figée).
 */
export async function renderRempartCreative(input: {
  background: Buffer;
  title: string;
  highlightWords?: string[];
}): Promise<Buffer> {
  const { lines, highlightSet } = layoutTitleLines(
    input.title,
    input.highlightWords || [],
  );
  const fontSize = pickFontSize(lines);
  const lineHeight = Math.round(fontSize * 1.05);

  const [logoUri, shieldUri] = await Promise.all([
    fileToDataUri(assetPath("logo.png"), "image/png"),
    fileToDataUri(assetPath("favicon.png"), "image/png"),
  ]);

  const fontPath = assetPath("fonts", "Impact.ttf");

  // Fond recadré cover 1080×1440
  const bg = await sharp(input.background)
    .rotate()
    .resize(CREATIVE_WIDTH, CREATIVE_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const textBlockHeight = lines.length * lineHeight;
  const textBottom = CREATIVE_HEIGHT - 72;
  const textTop = textBottom - textBlockHeight;
  const ruleY = textTop - 48;
  const shieldSize = 56;
  const ruleHalfGap = 40;

  const textSvgLines = lines
    .map((line, i) => {
      const y = textTop + fontSize + i * lineHeight;
      return `<text x="540" y="${y}" text-anchor="middle" font-family="Impact" font-size="${fontSize}" letter-spacing="1">${renderLineSpans(line, highlightSet)}</text>`;
    })
    .join("\n");

  const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CREATIVE_WIDTH}" height="${CREATIVE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="35%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <!-- Dégradé bas -->
  <rect x="0" y="720" width="${CREATIVE_WIDTH}" height="720" fill="url(#bottomFade)"/>
  <!-- Logo haut gauche -->
  <image href="${logoUri}" x="36" y="36" width="300" height="115" preserveAspectRatio="xMinYMin meet"/>
  <!-- Filets or + bouclier -->
  <line x1="80" y1="${ruleY}" x2="${540 - ruleHalfGap}" y2="${ruleY}" stroke="${GOLD}" stroke-width="3"/>
  <line x1="${540 + ruleHalfGap}" y1="${ruleY}" x2="1000" y2="${ruleY}" stroke="${GOLD}" stroke-width="3"/>
  <image href="${shieldUri}" x="${540 - shieldSize / 2}" y="${ruleY - shieldSize / 2}" width="${shieldSize}" height="${shieldSize}" preserveAspectRatio="xMidYMid meet"/>
  ${textSvgLines}
</svg>`;

  const resvg = new Resvg(overlaySvg, {
    fitTo: { mode: "width", value: CREATIVE_WIDTH },
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: "Impact",
    },
  });
  const overlayPng = resvg.render().asPng();

  return sharp(bg)
    .composite([{ input: Buffer.from(overlayPng), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
