import type { DossierCoverage, ResearchDossier } from "@/lib/research/types";
import { estimateSourceTier } from "@/lib/research/source-hierarchy";

function pct(value: number, fullAt: number): number {
  if (fullAt <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / fullAt) * 100)));
}

function filledCount(parts: string[]): number {
  return parts.filter((p) => p.trim().length > 0).length;
}

/**
 * Indicateur de couverture 0–100 % — ce qu'il reste à enrichir objectivement.
 * Ne punit pas une section absente si le sujet n'a pas de matière (heuristique simple).
 */
export function computeDossierCoverage(dossier: ResearchDossier): DossierCoverage {
  const summaryFill = filledCount([
    dossier.summary.who,
    dossier.summary.what,
    dossier.summary.when,
    dossier.summary.where,
    dossier.summary.why,
    dossier.summary.how,
  ]);

  const facts = pct(
    summaryFill * 0.5 +
      Math.min(dossier.keyFacts.length, 6) +
      dossier.keyFacts.filter((f) => f.confidence === "confirmed").length * 0.5,
    6 + 6 + 3,
  );

  const chronology = pct(dossier.chronology.length, 5);

  const primaryLike = dossier.sources.filter((s) => {
    const tier = s.tier ?? estimateSourceTier(s);
    return tier <= 4;
  }).length;
  const primarySources = pct(primaryLike, 2);

  const context = pct(
    filledCount([dossier.importance.whyItMatters]) * 2 +
      dossier.politicalContext.institutions.length +
      dossier.politicalContext.consequences.length +
      dossier.actors.length,
    2 + 2 + 2 + 3,
  );

  const reactionCount =
    dossier.reactions.government.length +
    dossier.reactions.opposition.length +
    dossier.reactions.experts.length +
    dossier.reactions.associations.length +
    dossier.reactions.academics.length +
    dossier.reactions.unions.length +
    dossier.reactions.ngos.length;
  const reactions = pct(reactionCount, 4);

  const history = pct(
    dossier.history.precedents.length +
      dossier.history.similarCases.length +
      dossier.history.politicalHistory.length +
      dossier.history.judicialHistory.length,
    4,
  );

  const legal = pct(
    dossier.legalContext.laws.length +
      dossier.legalContext.procedures.length +
      dossier.legalContext.caseLaw.length,
    3,
  );

  const statistics = pct(
    dossier.data.statistics.length +
      dossier.data.reports.length +
      dossier.data.budgets.length,
    3,
  );

  const overall = Math.round(
    (facts +
      chronology +
      primarySources +
      context +
      reactions +
      history +
      legal +
      statistics) /
      8,
  );

  return {
    facts,
    chronology,
    primarySources,
    context,
    reactions,
    history,
    legal,
    statistics,
    overall,
  };
}
