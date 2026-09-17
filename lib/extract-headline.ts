import path from "path";
import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { withTimeout } from "@/lib/with-timeout";

const OCR_MAX_MS = 8_000;
const TESSDATA = path.join(process.cwd(), "ocr-data");

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("fra", 1, {
      langPath: TESSDATA,
      gzip: false,
      cachePath: "/tmp",
      cacheMethod: "none",
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Tesseract lit mieux du noir sur blanc. Les créatives Rempart
 * (titre Impact blanc/or sur fond sombre) sont donc inversées.
 */
async function pngForOcr(buffer: Buffer): Promise<Buffer> {
  const base = sharp(buffer, { failOn: "none" }).rotate().resize(900, 1200, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const stats = await base.clone().stats();
  const channels = stats.channels.slice(0, 3);
  const mean =
    channels.reduce((sum, c) => sum + c.mean, 0) / Math.max(channels.length, 1);
  const pipeline = base.clone().greyscale().normalise().sharpen();
  if (mean < 140) {
    pipeline.negate({ alpha: false });
  }
  return pipeline.png().toBuffer();
}

function cleanOcrText(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .filter((line) => !/^(le\s+)?rempart\.?$/i.test(line))
    .filter((line) => /[A-Za-zÀ-ÿ]{3,}/.test(line));
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

async function ocrHeadline(png: Buffer): Promise<string> {
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  });
  const { data } = await worker.recognize(png);
  const fromLines = (data.lines || [])
    .filter((line) => (line.confidence ?? 0) >= 40)
    .map((line) => line.text)
    .join("\n");
  const title = cleanOcrText(fromLines || data.text || "");
  if (title.length >= 8) return title.slice(0, 200);
  throw new Error("Titre extrait trop court");
}

/**
 * Lit le titre écrit sur la créative — OCR local, pas Kimi.
 */
export async function extractHeadlineFromCreative(input: {
  buffer: Buffer;
  mime: string;
}): Promise<string> {
  const png = await pngForOcr(input.buffer);
  try {
    return await withTimeout(ocrHeadline(png), OCR_MAX_MS, "Lecture du titre");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout/i.test(msg) || /trop court/i.test(msg)) {
      throw new Error(
        "Titre illisible sur la créative. Envoie-la avec le titre en légende.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}
