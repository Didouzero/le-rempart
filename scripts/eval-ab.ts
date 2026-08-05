/**
 * Harnais A/B local (pas de commit requis) :
 *   npm run eval:ab:sample
 *   npm run eval:ab -- --limit 10 --dossier
 *   npm run eval:ab -- --limit 75 --dossier   # corpus complet (~long)
 *
 * Sortie tmp/eval/<timestamp>/ :
 *   index.json, SCOREBOARD.md
 *   <id>/{legacy.md,new.md,comparison.json,scorecard.md,dossier.json?}
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { runAbEvaluation } from "../lib/eval/ab";
import { renderManualScorecardMarkdown } from "../lib/eval/scorecard";

/** Charge .env local (Next le fait tout seul ; tsx/node non). */
async function loadEnvFile(root: string): Promise<void> {
  const envPath = path.join(root, ".env");
  try {
    await access(envPath);
  } catch {
    return;
  }
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

type SubjectRow = {
  id: string;
  title: string;
  category?: string;
  sourceUrl?: string | null;
  /** Fichier texte local (quand le site bloque le scrape bot). */
  sourceTextFile?: string | null;
};

type IndexRow = {
  id: string;
  category?: string;
  ok: boolean;
  error?: string;
  legacyScore?: number;
  newScore?: number;
  delta?: number;
  bucket?: "new_better" | "equivalent" | "legacy_better" | "error";
  gains?: string[];
  losses?: string[];
  summary?: string[];
  durationMs?: number;
};

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function bucketFromDelta(delta: number): IndexRow["bucket"] {
  if (delta >= 5) return "new_better";
  if (delta <= -5) return "legacy_better";
  return "equivalent";
}

function renderScoreboard(rows: IndexRow[]): string {
  const ok = rows.filter((r) => r.ok);
  const better = ok.filter((r) => r.bucket === "new_better");
  const equiv = ok.filter((r) => r.bucket === "equivalent");
  const worse = ok.filter((r) => r.bucket === "legacy_better");
  const avgLegacy =
    ok.length > 0
      ? Math.round(
          ok.reduce((s, r) => s + (r.legacyScore || 0), 0) / ok.length,
        )
      : 0;
  const avgNew =
    ok.length > 0
      ? Math.round(ok.reduce((s, r) => s + (r.newScore || 0), 0) / ok.length)
      : 0;

  const table = ok
    .map(
      (r) =>
        `| ${r.id} | ${r.category || "?"} | ${r.legacyScore} | ${r.newScore} | ${
          (r.delta || 0) >= 0 ? "+" : ""
        }${r.delta} | ${r.bucket} |`,
    )
    .join("\n");

  return `# SCOREBOARD A/B (proxy automatique)

> Ces scores accélèrent la revue humaine. Ils ne décident pas quoi publier.
> Critère de succès : vous choisiriez réellement la version **Nouveau** à la publication.

## Synthèse

- Sujets OK : ${ok.length}/${rows.length}
- Nouveau meilleur (Δ≥+5) : **${better.length}**
- Équivalent (|Δ|<5) : **${equiv.length}**
- Legacy meilleur (Δ≤-5) : **${worse.length}**
- Moyenne Legacy : **${avgLegacy}/100**
- Moyenne Nouveau : **${avgNew}/100**

## Tableau

| id | catégorie | Legacy | Nouveau | Δ | bucket |
|----|-----------|--------|---------|---|--------|
${table}

## Régressions à investiguer (legacy meilleur)

${
  worse.length
    ? worse
        .map(
          (r) =>
            `- **${r.id}** (Δ ${r.delta}) — pertes proxy : ${(r.losses || []).join(", ") || "n/a"}`,
        )
        .join("\n")
    : "_Aucune pour l'instant (sur ce lot)._"
}

## Prochaine étape

Pour chaque sujet : ouvrir \`scorecard.md\`, noter /10, cocher **Lequel publierais-je réellement ?**,
et rattacher toute faiblesse à Research / Dossier / Writing.
`;
}

async function main() {
  const root = process.cwd();
  await loadEnvFile(root);

  if (!process.env.MOONSHOT_API_KEY?.trim()) {
    console.error(
      "MOONSHOT_API_KEY manquant.\n" +
        "Vérifie que le fichier .env à la racine de le-rempart contient bien MOONSHOT_API_KEY=...",
    );
    process.exit(1);
  }

  const subjectsPath = path.join(root, "lib/eval/subjects.json");
  const raw = JSON.parse(await readFile(subjectsPath, "utf8")) as {
    subjects: SubjectRow[];
  };

  const limit = Number(argValue("--limit") || "3");
  const offset = Number(argValue("--offset") || "0");
  const idsRaw = argValue("--ids");
  const includeDossier = hasFlag("--dossier");

  let subjects = raw.subjects;
  if (idsRaw) {
    const want = new Set(
      idsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    subjects = subjects.filter((s) => want.has(s.id));
  } else {
    subjects = subjects.slice(offset, offset + limit);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(root, "tmp/eval", stamp);
  await mkdir(outDir, { recursive: true });

  console.log(
    `A/B eval — ${subjects.length}/${raw.subjects.length} sujet(s) → ${outDir}`,
  );
  console.log("(Pas de commit — phase d'évaluation éditoriale uniquement)");

  const index: IndexRow[] = [];

  for (const row of subjects) {
    console.log(`\n▶ ${row.id}`);
    const started = Date.now();
    try {
      let sourceText: string | undefined;
      if (row.sourceTextFile) {
        const textPath = path.isAbsolute(row.sourceTextFile)
          ? row.sourceTextFile
          : path.join(root, row.sourceTextFile);
        sourceText = await readFile(textPath, "utf8");
        console.log(`  sourceTextFile: ${row.sourceTextFile} (${sourceText.length} car.)`);
      }

      const ab = await runAbEvaluation(
        {
          title: row.title,
          sourceUrl: row.sourceUrl || undefined,
          sourceText,
        },
        { includeDossier },
      );

      const folder = path.join(outDir, row.id);
      await mkdir(folder, { recursive: true });
      await writeFile(
        path.join(folder, "legacy.md"),
        `# ${ab.legacy.article.title}\n\n${ab.legacy.article.excerpt}\n\n${ab.legacy.article.content}\n`,
      );
      await writeFile(
        path.join(folder, "new.md"),
        `# ${ab.neu.article.title}\n\n${ab.neu.article.excerpt}\n\n${ab.neu.article.content}\n`,
      );

      const global = ab.comparison.global;
      await writeFile(
        path.join(folder, "scorecard.md"),
        renderManualScorecardMarkdown({
          subjectId: row.id,
          title: row.title,
          global,
        }),
      );

      await writeFile(
        path.join(folder, "comparison.json"),
        JSON.stringify(
          {
            id: row.id,
            category: row.category,
            durationMs: Date.now() - started,
            comparison: ab.comparison,
            global,
            legacyMetrics: ab.legacy.metrics,
            newMetrics: ab.neu.metrics,
            legacyObs: {
              ...ab.legacy.observability,
              dossier: undefined,
            },
            newObs: {
              ...ab.neu.observability,
              dossier: includeDossier
                ? ab.neu.observability.dossier
                : undefined,
            },
            writingMetadata: ab.neu.observability.writingMetadata,
            coverage: ab.neu.observability.coverage,
            quality: ab.neu.observability.quality,
          },
          null,
          2,
        ),
      );
      if (includeDossier && ab.neu.observability.dossier) {
        await writeFile(
          path.join(folder, "dossier.json"),
          JSON.stringify(ab.neu.observability.dossier, null, 2),
        );
      }

      const delta = global.delta;
      index.push({
        id: row.id,
        category: row.category,
        ok: true,
        legacyScore: global.legacyScore,
        newScore: global.newScore,
        delta,
        bucket: bucketFromDelta(delta),
        gains: global.gains.map((g) => g.label),
        losses: global.losses.map((g) => g.label),
        summary: ab.comparison.summary,
        durationMs: Date.now() - started,
      });
      console.log(
        `  ✓ Legacy ${global.legacyScore}/100 → New ${global.newScore}/100 (${delta >= 0 ? "+" : ""}${delta})`,
      );
      console.log(`    ${global.headline.slice(2).join(" · ") || "—"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      index.push({
        id: row.id,
        category: row.category,
        ok: false,
        error: msg,
        bucket: "error",
      });
      console.error("  ✗", msg);
    }
  }

  await writeFile(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
  await writeFile(path.join(outDir, "SCOREBOARD.md"), renderScoreboard(index));
  console.log(`\nTerminé.`);
  console.log(`Index      : ${path.join(outDir, "index.json")}`);
  console.log(`Scoreboard : ${path.join(outDir, "SCOREBOARD.md")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
