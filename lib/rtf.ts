/**
 * Texte brut d'un fichier RTF (TextEdit, Word) : assez pour lire une précision
 * envoyée sur Telegram. Mise en forme, polices, couleurs et images sont ignorées.
 */

export function looksLikeRtf(raw: string): boolean {
  return /^\s*\{\\rtf/.test(raw);
}

/** Groupes sans texte à afficher : tables de polices, couleurs, styles, métadonnées, images. */
const SKIPPED_DESTINATIONS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "footer",
  "headerl",
  "headerr",
  "footerl",
  "footerr",
  "listtable",
  "listoverridetable",
  "rsidtbl",
  "generator",
  "themedata",
  "colorschememapping",
  "datastore",
  "latentstyles",
  "xmlnstbl",
  "expandedcolortbl",
]);

const SPECIAL_WORDS: Record<string, string> = {
  par: "\n",
  line: "\n",
  sect: "\n\n",
  page: "\n\n",
  tab: "\t",
  cell: "\t",
  row: "\n",
  emdash: "—",
  endash: "–",
  bullet: "•",
  lquote: "‘",
  rquote: "’",
  ldblquote: "“",
  rdblquote: "”",
  emspace: " ",
  enspace: " ",
  qmspace: " ",
};

const cp1252 = new TextDecoder("windows-1252");

export function rtfToText(rtf: string): string {
  let out = "";
  let i = 0;
  // Pile des groupes : faut-il ignorer ce groupe, et combien de caractères sauter après \uN.
  const stack: { skip: boolean; uc: number }[] = [];
  let skip = false;
  let uc = 1;
  let pendingSkip = 0; // caractères de repli à sauter après un \uN
  const hexBytes: number[] = [];

  const flushHex = () => {
    if (!hexBytes.length) return;
    if (!skip) out += cp1252.decode(Uint8Array.from(hexBytes));
    hexBytes.length = 0;
  };
  const emit = (s: string) => {
    flushHex();
    if (pendingSkip > 0) {
      pendingSkip--;
      return;
    }
    if (!skip) out += s;
  };

  while (i < rtf.length) {
    const c = rtf[i]!;
    if (c === "{") {
      flushHex();
      stack.push({ skip, uc });
      i++;
      // {\*\destination …} : destination optionnelle, ignorée si inconnue.
      if (rtf.startsWith("\\*", i)) skip = true;
      continue;
    }
    if (c === "}") {
      flushHex();
      const prev = stack.pop();
      if (prev) {
        skip = prev.skip;
        uc = prev.uc;
      }
      pendingSkip = 0;
      i++;
      continue;
    }
    if (c === "\\") {
      const next = rtf[i + 1];
      if (next === undefined) break;
      if (next === "'") {
        const byte = parseInt(rtf.slice(i + 2, i + 4), 16);
        i += 4;
        if (Number.isNaN(byte)) continue;
        if (pendingSkip > 0) {
          pendingSkip--;
          continue;
        }
        hexBytes.push(byte);
        continue;
      }
      if (next === "\\" || next === "{" || next === "}") {
        emit(next);
        i += 2;
        continue;
      }
      if (next === "~") {
        emit(" ");
        i += 2;
        continue;
      }
      if (next === "-" || next === "_") {
        if (next === "_") emit("-");
        i += 2;
        continue;
      }
      if (next === "\n" || next === "\r") {
        emit("\n");
        i += 2;
        continue;
      }
      if (next === "*") {
        i += 2;
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) {
        i += 2;
        continue;
      }
      i += 1 + m[0].length;
      const word = m[1]!;
      const arg = m[2] === undefined ? null : Number(m[2]);
      if (SKIPPED_DESTINATIONS.has(word)) {
        flushHex();
        skip = true;
        continue;
      }
      if (word === "uc" && arg !== null) {
        uc = arg;
        continue;
      }
      if (word === "u" && arg !== null) {
        flushHex();
        const code = arg < 0 ? arg + 65536 : arg;
        if (!skip) out += String.fromCharCode(code);
        pendingSkip = uc;
        continue;
      }
      const special = SPECIAL_WORDS[word];
      if (special !== undefined) emit(special);
      continue;
    }
    if (c === "\n" || c === "\r") {
      i++;
      continue;
    }
    emit(c);
    i++;
  }
  flushHex();

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
