/**
 * Contrôle un texte prêt lu sur l'entrée standard, avec les règles appliquées à la publication.
 * Appelé par le canal Claude (tools/claude-channel) avant d'envoyer le texte à l'éditeur.
 */

import {
  finishReadyArticle,
  finishReadyFlash,
  finishReadyInvestigation,
  parseReadyArticle,
} from "@/lib/ready-article";

async function main() {
  let text = "";
  for await (const part of process.stdin) text += part;
  const kind = process.argv[2];
  const finish = kind === "enquete" ? finishReadyInvestigation : finishReadyArticle;
  const { issues } = kind === "flash" ? finishReadyFlash(text) : finish(parseReadyArticle(text));
  if (issues.length) throw new Error(`Texte à corriger : ${issues.join(" ; ")}`);
}

main().catch((err) => {
  console.log(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
