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
  // ~15% plus petit que la passe précédente
  const byWidth = (900 / maxLine) * 100;
  return Math.max(66, Math.min(88, Math.floor(byWidth)));
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
  // Interligne légèrement resserré
  const lineHeight = Math.round(fontSize * 1.28);

  const logoPath = assetPath("creative", "le-rempart.png");
  const [logoUri, castleUri] = await Promise.all([
    fileToDataUri(logoPath, "image/png"),
    fileToDataUri(assetPath("creative", "castle.png"), "image/png"),
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

  // Bloc titre plus aéré → on remonte un peu le bas pour tenir dans le cadre
  const textBlockHeight = lines.length * lineHeight;
  const textBottom = CREATIVE_HEIGHT - 56;
  const textTop = Math.max(520, textBottom - textBlockHeight);
  const ruleY = textTop - 32;

  // Wordmark haut gauche
  const logoW = 228;
  const logoH = Math.round(logoW * (127 / 791));
  const logoX = 70;
  const logoY = 88;

  // Emblème castle (~+50%) — bas pile à ras des filets
  const castleW = 252;
  const castleH = Math.round(castleW * (174 / 838));
  // Filets juste après le PNG château (petit air)
  const ruleHalfGap = Math.round(castleW / 2) + 10;
  const ruleStroke = 4;
  const ruleLeft = 70;
  const ruleRight = CREATIVE_WIDTH - 70;
  // Bas du château pile à ras des filets (aligné sur l'axe des traits)
  const castleY = ruleY - castleH + ruleStroke / 2;

  const textSvgLines = lines
    .map((line, i) => {
      const y = textTop + fontSize + i * lineHeight;
      return `<text x="540" y="${y}" text-anchor="middle" font-family="Impact" font-size="${fontSize}" letter-spacing="-1.2">${renderLineSpans(line, highlightSet)}</text>`;
    })
    .join("\n");

  // Halo logo : ellipse allongée type « haricot » horizontal, bien estompée
  const logoCx = logoX + logoW / 2;
  const logoCy = logoY + logoH / 2;
  const logoRx = logoW * 1.05;
  const logoRy = Math.max(logoH * 1.55, 48);

  const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CREATIVE_WIDTH}" height="${CREATIVE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="12%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="28%" stop-color="#000000" stop-opacity="0.1"/>
      <stop offset="42%" stop-color="#000000" stop-opacity="0.28"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.52"/>
      <stop offset="68%" stop-color="#000000" stop-opacity="0.75"/>
      <stop offset="84%" stop-color="#000000" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="logoWash" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.48"/>
      <stop offset="25%" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="48%" stop-color="#000000" stop-opacity="0.08"/>
      <stop offset="72%" stop-color="#000000" stop-opacity="0.02"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${CREATIVE_WIDTH}" height="${CREATIVE_HEIGHT}" fill="url(#bottomFade)"/>
  <!-- Halo noir progressif derrière LE REMPART -->
  <ellipse cx="${logoCx}" cy="${logoCy}" rx="${logoRx}" ry="${logoRy}" fill="url(#logoWash)"/>
  <image href="${logoUri}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMin meet"/>
  <line x1="${ruleLeft}" y1="${ruleY}" x2="${540 - ruleHalfGap}" y2="${ruleY}" stroke="${GOLD}" stroke-width="${ruleStroke}" stroke-linecap="butt"/>
  <line x1="${540 + ruleHalfGap}" y1="${ruleY}" x2="${ruleRight}" y2="${ruleY}" stroke="${GOLD}" stroke-width="${ruleStroke}" stroke-linecap="butt"/>
  <image href="${castleUri}" x="${540 - castleW / 2}" y="${castleY}" width="${castleW}" height="${castleH}" preserveAspectRatio="xMidYMid meet"/>
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
  const overlayPng = Buffer.from(resvg.render().asPng());

  return sharp(bg)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
