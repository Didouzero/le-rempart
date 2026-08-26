import { getKimiTextModel } from "@/lib/kimi-legacy";
import { moonshotChat } from "@/lib/moonshot";
import {
  emptyResearchDossier,
  type ConfidenceLevel,
  type KnowledgeEdge,
  type KnowledgeNode,
  type ResearchDossier,
  type SourceDocument,
} from "@/lib/research/types";

const BUILD_SYSTEM = `Tu es un Knowledge Builder documentaire (pas un journaliste, pas un éditorialiste).

Mission : construire un dossier de connaissances STRUCTURÉ à partir des documents fournis.
Priorité source-first : documents officiels > communiqués > décisions de justice > rapports > déclarations > agences > presse > réseaux sociaux.

Règles absolues :
- AUCUNE opinion, AUCUN ton partisan, AUCUNE formulation journalistique, AUCUN angle éditorial.
- N'utilise QUE les informations présentes dans les documents fournis.
- Si une info manque : missingInformation / uncertainties — NE L'INVENTE PAS.
- Laisse VIDE une section sans matière fiable (liste vide). Jamais de remplissage artificiel.
- Chaque fait important doit être TRAÇABLE : sourceUrls, confirmingSourceCount, primaryEvidenceUrl.
- confidence = confirmed | probable | contested | unverifiable.
- Construis aussi un graphe simple (nodes + edges) reliant acteurs, événements, documents, réactions.
- Réponds UNIQUEMENT en JSON valide (pas de markdown autour).

DENSITÉ D'EXTRACTION (le rédacteur ne pourra écrire que ce que tu extrais) :
- keyFacts : vise 10 à 20 faits atomiques quand le corpus le permet. Un fait = une information vérifiable, chiffrée ou datée si possible.
- Recopie les MONTANTS exacts (déficit, dette, masse salariale, subventions, nombre de salariés, nombre de logements) tels qu'écrits dans les documents.
- Nomme les PERSONNES : nom complet + fonction exacte + étiquette politique / affiliation si le document la donne. Jamais un "un dirigeant" quand le nom figure dans le corpus.
- Nomme les ORGANISATIONS avec leur périmètre exact (fédération, antenne départementale, filiale) : ne confonds pas une structure locale et son réseau national.
- chronology : reconstitue la séquence datée (alerte, procédure, décision, audience, liquidation), même partielle.
- citations : recopie les verbatims entre guillemets présents dans les documents, avec auteur et fonction.
- data.budgets / data.statistics : tous les chiffres financiers et volumétriques du corpus.
- mediaHistory : indique quel média a révélé quoi et à quelle date (ex. "enquête de X du 13/10/2025").
- conceptsToExplain : les notions de procédure ou de gestion que le lecteur ne connaît pas (redressement judiciaire, liquidation, mandataire, masse salariale…).
- Si le corpus parle d'une AUTRE affaire que le sujet demandé, ne l'intègre pas : signale-le dans uncertainties.

Forme JSON :
{
  "summary": {"who":"","what":"","when":"","where":"","why":"","how":""},
  "keyFacts": [{"text":"","confidence":"confirmed","sourceUrls":["https://..."],"confirmingSourceCount":1,"primaryEvidenceUrl":"https://..."}],
  "actors": [{"name":"","kind":"principal|secondary|institution|organization|company|association|concerned_person","role":"","partyOrAffiliation":"","confidence":"confirmed","nodeId":"actor_1"}],
  "secondaryAngleDivergences": [],
  "citations": [{"quote":"","author":"","date":"","context":"","sourceUrl":"","confidence":"confirmed"}],
  "chronology": [{"date":"","description":"","confidence":"confirmed","sourceUrl":"","sourceUrls":[],"nodeId":"event_1"}],
  "history": {"precedents":[],"similarCases":[],"politicalHistory":[],"judicialHistory":[],"mediaHistory":[]},
  "data": {"statistics":[],"reports":[],"studies":[],"internationalComparisons":[],"budgets":[],"trends":[]},
  "politicalContext": {"actors":[],"parties":[],"institutions":[],"consequences":[]},
  "legalContext": {"laws":[],"caseLaw":[],"procedures":[],"investigations":[],"europeanTexts":[]},
  "reactions": {"government":[],"opposition":[],"experts":[],"associations":[],"academics":[],"unions":[],"ngos":[]},
  "socialMedia": {"officialPosts":[],"videos":[],"declarations":[],"viralElements":[]},
  "verification": [{"claim":"","status":"confirmed","notes":"","sourceUrl":"","sourceUrls":[]}],
  "uncertainties": [],
  "missingInformation": [],
  "importance": {"whyItMatters":"enjeux FACTUELS — pas une opinion","stakes":[]},
  "conceptsToExplain": [{"term":"","whyNeeded":"","shortDefinition":""}],
  "glossary": [{"term":"","definition":""}],
  "naiveQuestions": [{"question":"","answer":"","unanswered":true}],
  "articleQuestions": [],
  "graph": {
    "nodes": [{"id":"actor_1","type":"actor|event|document|claim|institution|reaction|concept","label":"","confidence":"confirmed"}],
    "edges": [{"id":"e1","from":"actor_1","to":"event_1","type":"declares|participates_in|causes|reacts_to|based_on|confirms|contests|related_to","label":"","confidence":"confirmed","sourceUrls":[]}]
  },
  "extensions": {}
}`;

/**
 * Budget de sortie du builder.
 * Le JSON complet (graphe, glossaire, questions) coûte des milliers de tokens :
 * en mode rapide on sacrifie l'accessoire, jamais les faits.
 */
type BuildProfile = "full" | "compact" | "minimal";

const PROFILE_INSTRUCTIONS: Record<BuildProfile, string> = {
  full: "",
  compact: `
MODE COMPACT (budget de sortie limité — priorité aux faits) :
- OMETS entièrement : graph, socialMedia, naiveQuestions, articleQuestions, glossary, verification,
  history.precedents, history.similarCases, data.studies, data.internationalComparisons.
- GARDE et remplis en priorité : summary, keyFacts (10 à 12), actors (8 max), chronology (8 max),
  citations (3 max), data.budgets, data.statistics, history.mediaHistory, politicalContext,
  legalContext.procedures, reactions, importance, uncertainties, missingInformation,
  conceptsToExplain (3 max).
- ORDRE DE SORTIE IMPOSÉ (les premières clés sont les plus importantes) :
  summary, chronology, keyFacts, actors, data, history.mediaHistory, citations, politicalContext,
  legalContext, reactions, importance, conceptsToExplain, uncertainties, missingInformation.
- chronology est OBLIGATOIRE : toute date citée dans le corpus devient un jalon daté.
  Ne range pas les dates uniquement dans keyFacts.
- Une phrase par entrée, aucune redondance entre sections, pas de reformulation.`,
  minimal: `
MODE MINIMAL (budget très serré) :
- Renvoie UNIQUEMENT ces clés, dans cet ordre : summary, chronology (6 max), keyFacts (8 à 10),
  actors (6 max), data.budgets, data.statistics, importance, uncertainties, missingInformation.
- Omets tout le reste. Une phrase par fait, chiffres et noms conservés tels quels.`,
};

const CONFIDENCE: ConfidenceLevel[] = [
  "confirmed",
  "probable",
  "contested",
  "unverifiable",
];

function asConfidence(v: unknown): ConfidenceLevel {
  const s = String(v || "").toLowerCase();
  if (s === "false") return "contested";
  if (s === "unknown") return "unverifiable";
  if (CONFIDENCE.includes(s as ConfidenceLevel)) return s as ConfidenceLevel;
  return "probable";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Research build: JSON introuvable");
  let text = match[0];
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Réparations légères fréquentes (virgules traînantes / troncature).
    text = text.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      // JSON tronqué : ferme les structures ouvertes au mieux.
      let repaired = text;
      const opens = (repaired.match(/\{/g) || []).length;
      const closes = (repaired.match(/\}/g) || []).length;
      const openArr = (repaired.match(/\[/g) || []).length;
      const closeArr = (repaired.match(/\]/g) || []).length;
      repaired = repaired.replace(/,\s*$/, "");
      for (let i = 0; i < openArr - closeArr; i += 1) repaired += "]";
      for (let i = 0; i < opens - closes; i += 1) repaired += "}";
      return JSON.parse(repaired) as Record<string, unknown>;
    }
  }
}

function documentsBlock(sources: SourceDocument[], perDocChars = 5500): string {
  return sources
    .map((s, i) => {
      const body = (s.excerpt || "").trim();
      return [
        `### Document ${i + 1}`,
        `title: ${s.title}`,
        `url: ${s.url}`,
        `publisher: ${s.publisher || "?"}`,
        `type: ${s.type}`,
        `tier: ${s.tier ?? "?"}`,
        `scraped: ${s.scraped}`,
        `confidence: ${s.confidence}`,
        body
          ? // Cap pour laisser de la place au JSON de sortie (évite troncature).
            `contenu:\n${body.slice(0, perDocChars)}`
          : "(contenu non scrapé — titre / métadonnées seulement)",
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Construit un dossier à partir de documents déjà collectés.
 * Knowledge Builder : extraction structurée, pas de revue de presse.
 */
export async function buildDossierFromDocuments(input: {
  subject: string;
  sourceUrl?: string;
  sources: SourceDocument[];
  focusMissing?: string[];
  focusQueries?: string[];
  /** Accroche Canva — information secondaire, jamais une source de faits. */
  secondaryCaption?: string;
  /** Timeouts plus courts (chemin Telegram / Vercel). */
  fast?: boolean;
}): Promise<ResearchDossier> {
  const base = emptyResearchDossier(input.subject, input.sourceUrl);
  base.sources = input.sources;
  base.primarySources = input.sources.filter(
    (s) => s.type === "primary" || s.type === "official",
  );
  base.secondarySources = input.sources.filter((s) => s.type === "secondary");
  base.collectedDocuments = input.sources
    .filter((s) => (s.excerpt || "").trim().length >= 80)
    .map((s) => ({
      url: s.url,
      title: s.title,
      excerpt: s.excerpt!.slice(0, 4000),
      fetchedAt: s.retrievedAt,
      publisher: s.publisher,
      type: s.type,
    }));

  if (!process.env.MOONSHOT_API_KEY) {
    base.missingInformation.push("MOONSHOT_API_KEY absent — dossier non structuré.");
    return base;
  }

  // Scrapes complets OU snippets de recherche web (sinon caption seule = dossier vide).
  const usable = input.sources.filter(
    (s) => (s.excerpt || "").trim().length >= 80,
  );
  if (usable.length === 0) {
    base.missingInformation.push(
      "Aucun document ni résultat de recherche exploitable pour construire le dossier.",
    );
    return base;
  }

  const focus =
    input.focusMissing?.length || input.focusQueries?.length
      ? [
          "Priorité d'enrichissement pour cette passe :",
          ...(input.focusMissing || []).map((m) => `- manque: ${m}`),
          ...(input.focusQueries || []).map((q) => `- requête: ${q}`),
        ].join("\n")
      : "";

  const researchModel = process.env.KIMI_RESEARCH_MODEL?.trim() || "kimi-k2.6";
  const fallbackModel = getKimiTextModel();

  /**
   * Chaque tentative réduit le coût de sortie. En mode rapide, mieux vaut un
   * dossier compact abouti qu'un JSON riche coupé par le timeout : quand le
   * builder échoue, le pipeline retombe sur le legacy sans dossier du tout.
   */
  const   attempts: Array<{
    model: string;
    profile: BuildProfile;
    maxTokens: number;
    timeoutMs: number;
    corpusChars: number;
  }> = input.fast
    ? [
        // Source déjà scrapée : viser un dossier compact qui tient sous le
        // budget research Telegram (~150–160 s) sans double tentative longue.
        {
          model: researchModel,
          profile: "minimal",
          maxTokens: 2400,
          timeoutMs: 55_000,
          corpusChars: 10_000,
        },
        {
          model: researchModel,
          profile: "compact",
          maxTokens: 3600,
          timeoutMs: 75_000,
          corpusChars: 12_000,
        },
      ]
    : [
        {
          model: researchModel,
          profile: "full",
          maxTokens: 5500,
          timeoutMs: 150_000,
          corpusChars: 26_000,
        },
        {
          model: researchModel,
          profile: "compact",
          maxTokens: 4200,
          timeoutMs: 90_000,
          corpusChars: 16_000,
        },
        {
          model: fallbackModel || researchModel,
          profile: "minimal",
          maxTokens: 2600,
          timeoutMs: 60_000,
          corpusChars: 9_000,
        },
      ];

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts.length; attempt += 1) {
    const { model, profile, maxTokens, timeoutMs, corpusChars } =
      attempts[attempt]!;
    const perDoc = Math.max(1800, Math.floor(corpusChars / usable.length));
    const userContent = [
      `Sujet à documenter : ${input.subject}`,
      input.sourceUrl
        ? `URL de départ (entrée principale) : ${input.sourceUrl}`
        : "",
      input.secondaryCaption
        ? `Accroche éditoriale secondaire (NE PAS traiter comme source de faits) : ${input.secondaryCaption}`
        : "",
      focus,
      "Documents / résultats de recherche (corpus unique — n'extrais rien hors de ce corpus).",
      "Si scraped=false / snippet_only : utiliser titre+extrait avec confidence probable, pas confirmed.",
      documentsBlock(usable, perDoc),
      "Produis le JSON du dossier de connaissances. Sections sans matière fiable = listes vides.",
      attempt > 0
        ? "RETRY : la tentative précédente a échoué (timeout ou JSON incomplet). Sois plus bref, mais garde tous les noms, montants et dates."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const raw = await moonshotChat({
        model,
        maxTokens,
        timeoutMs,
        reasoningEffort: "low",
        messages: [
          {
            role: "system",
            content: `${BUILD_SYSTEM}\n${PROFILE_INSTRUCTIONS[profile]}`.trim(),
          },
          { role: "user", content: userContent },
        ],
      });
      const parsed = parseJsonObject(raw);
      return hydrateDossier(base, parsed);
    } catch (err) {
      lastErr = err;
      console.error("research build attempt failed", model, profile, err);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Research build: échec après retries");
}

function hydrateDossier(
  base: ResearchDossier,
  parsed: Record<string, unknown>,
): ResearchDossier {
  const summary = (parsed.summary || {}) as Record<string, unknown>;
  base.summary = {
    who: String(summary.who || ""),
    what: String(summary.what || ""),
    when: String(summary.when || ""),
    where: String(summary.where || ""),
    why: String(summary.why || ""),
    how: String(summary.how || ""),
  };

  base.keyFacts = Array.isArray(parsed.keyFacts)
    ? parsed.keyFacts.map((f) => {
        const row = f as Record<string, unknown>;
        const sourceUrls = asStringArray(row.sourceUrls);
        const confirming = Number(row.confirmingSourceCount);
        return {
          text: String(row.text || "").trim(),
          confidence: asConfidence(row.confidence),
          sourceUrls,
          confirmingSourceCount:
            Number.isFinite(confirming) && confirming > 0
              ? confirming
              : Math.max(sourceUrls.length, sourceUrls.length ? 1 : 0),
          primaryEvidenceUrl: row.primaryEvidenceUrl
            ? String(row.primaryEvidenceUrl)
            : sourceUrls[0],
          nodeId: row.nodeId ? String(row.nodeId) : undefined,
        };
      }).filter((f) => f.text)
    : [];

  base.actors = Array.isArray(parsed.actors)
    ? parsed.actors.map((a) => {
        const row = a as Record<string, unknown>;
        return {
          name: String(row.name || "").trim(),
          kind: (String(row.kind || "secondary") as ResearchDossier["actors"][0]["kind"]),
          role: String(row.role || "").trim(),
          partyOrAffiliation: row.partyOrAffiliation
            ? String(row.partyOrAffiliation)
            : undefined,
          confidence: asConfidence(row.confidence),
          nodeId: row.nodeId ? String(row.nodeId) : undefined,
        };
      }).filter((a) => a.name)
    : [];

  base.secondaryAngleDivergences = asStringArray(parsed.secondaryAngleDivergences);

  base.citations = Array.isArray(parsed.citations)
    ? parsed.citations.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          quote: String(row.quote || "").trim(),
          author: String(row.author || "").trim(),
          date: row.date ? String(row.date) : undefined,
          context: row.context ? String(row.context) : undefined,
          sourceUrl: row.sourceUrl ? String(row.sourceUrl) : undefined,
          confidence: asConfidence(row.confidence),
        };
      }).filter((c) => c.quote)
    : [];

  base.chronology = Array.isArray(parsed.chronology)
    ? parsed.chronology.map((e) => {
        const row = e as Record<string, unknown>;
        const sourceUrls = asStringArray(row.sourceUrls);
        return {
          date: String(row.date || "").trim(),
          description: String(row.description || "").trim(),
          confidence: asConfidence(row.confidence),
          sourceUrl: row.sourceUrl
            ? String(row.sourceUrl)
            : sourceUrls[0],
          sourceUrls: sourceUrls.length ? sourceUrls : undefined,
          nodeId: row.nodeId ? String(row.nodeId) : undefined,
        };
      }).filter((e) => e.description)
    : [];

  const history = (parsed.history || {}) as Record<string, unknown>;
  base.history = {
    precedents: asStringArray(history.precedents),
    similarCases: asStringArray(history.similarCases),
    politicalHistory: asStringArray(history.politicalHistory),
    judicialHistory: asStringArray(history.judicialHistory),
    mediaHistory: asStringArray(history.mediaHistory),
  };

  const data = (parsed.data || {}) as Record<string, unknown>;
  base.data = {
    statistics: asStringArray(data.statistics),
    reports: asStringArray(data.reports),
    studies: asStringArray(data.studies),
    internationalComparisons: asStringArray(data.internationalComparisons),
    budgets: asStringArray(data.budgets),
    trends: asStringArray(data.trends),
  };

  const political = (parsed.politicalContext || {}) as Record<string, unknown>;
  base.politicalContext = {
    actors: asStringArray(political.actors),
    parties: asStringArray(political.parties),
    institutions: asStringArray(political.institutions),
    consequences: asStringArray(political.consequences),
  };

  const legal = (parsed.legalContext || {}) as Record<string, unknown>;
  base.legalContext = {
    laws: asStringArray(legal.laws),
    caseLaw: asStringArray(legal.caseLaw),
    procedures: asStringArray(legal.procedures),
    investigations: asStringArray(legal.investigations),
    europeanTexts: asStringArray(legal.europeanTexts),
  };

  const reactions = (parsed.reactions || {}) as Record<string, unknown>;
  base.reactions = {
    government: asStringArray(reactions.government),
    opposition: asStringArray(reactions.opposition),
    experts: asStringArray(reactions.experts),
    associations: asStringArray(reactions.associations),
    academics: asStringArray(reactions.academics),
    unions: asStringArray(reactions.unions),
    ngos: asStringArray(reactions.ngos),
  };

  const social = (parsed.socialMedia || {}) as Record<string, unknown>;
  base.socialMedia = {
    officialPosts: asStringArray(social.officialPosts),
    videos: asStringArray(social.videos),
    declarations: asStringArray(social.declarations),
    viralElements: asStringArray(social.viralElements),
  };

  base.verification = Array.isArray(parsed.verification)
    ? parsed.verification.map((v) => {
        const row = v as Record<string, unknown>;
        return {
          claim: String(row.claim || "").trim(),
          status: asConfidence(row.status),
          notes: row.notes ? String(row.notes) : undefined,
          sourceUrl: row.sourceUrl ? String(row.sourceUrl) : undefined,
        };
      }).filter((v) => v.claim)
    : [];

  base.uncertainties = asStringArray(parsed.uncertainties);
  base.missingInformation = asStringArray(parsed.missingInformation);

  const importance = (parsed.importance || {}) as Record<string, unknown>;
  base.importance = {
    whyItMatters: String(importance.whyItMatters || "").trim(),
    stakes: asStringArray(importance.stakes),
  };

  base.conceptsToExplain = Array.isArray(parsed.conceptsToExplain)
    ? parsed.conceptsToExplain.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          term: String(row.term || "").trim(),
          whyNeeded: String(row.whyNeeded || "").trim(),
          shortDefinition: String(row.shortDefinition || "").trim(),
        };
      }).filter((c) => c.term)
    : [];

  base.glossary = Array.isArray(parsed.glossary)
    ? parsed.glossary.map((g) => {
        const row = g as Record<string, unknown>;
        return {
          term: String(row.term || "").trim(),
          definition: String(row.definition || "").trim(),
        };
      }).filter((g) => g.term)
    : [];

  base.naiveQuestions = Array.isArray(parsed.naiveQuestions)
    ? parsed.naiveQuestions.map((q) => {
        const row = q as Record<string, unknown>;
        const answer = row.answer ? String(row.answer).trim() : "";
        return {
          question: String(row.question || "").trim(),
          answer: answer || undefined,
          unanswered: answer ? false : Boolean(row.unanswered ?? true),
          confidence: row.confidence ? asConfidence(row.confidence) : undefined,
        };
      }).filter((q) => q.question)
    : [];

  base.articleQuestions = asStringArray(parsed.articleQuestions);

  const graph = (parsed.graph || {}) as Record<string, unknown>;
  const nodes: KnowledgeNode[] = Array.isArray(graph.nodes)
    ? graph.nodes.map((n, i) => {
        const row = n as Record<string, unknown>;
        return {
          id: String(row.id || `node_${i + 1}`),
          type: String(row.type || "claim") as KnowledgeNode["type"],
          label: String(row.label || "").trim(),
          confidence: row.confidence
            ? asConfidence(row.confidence)
            : undefined,
        };
      }).filter((n) => n.label)
    : [];
  const edges: KnowledgeEdge[] = Array.isArray(graph.edges)
    ? graph.edges.map((e, i) => {
        const row = e as Record<string, unknown>;
        return {
          id: String(row.id || `edge_${i + 1}`),
          from: String(row.from || ""),
          to: String(row.to || ""),
          type: String(row.type || "related_to") as KnowledgeEdge["type"],
          label: row.label ? String(row.label) : undefined,
          confidence: row.confidence
            ? asConfidence(row.confidence)
            : undefined,
          sourceUrls: asStringArray(row.sourceUrls),
        };
      }).filter((e) => e.from && e.to)
    : [];
  base.graph = { nodes, edges };

  if (parsed.extensions && typeof parsed.extensions === "object") {
    base.extensions = parsed.extensions as Record<string, unknown>;
  }

  base.updatedAt = new Date().toISOString();
  return base;
}

/**
 * Fusionne un dossier d'enrichissement dans le dossier existant (union non destructive).
 */
export function mergeDossiers(
  base: ResearchDossier,
  patch: ResearchDossier,
): ResearchDossier {
  const uniq = (a: string[], b: string[]) => [...new Set([...a, ...b])];

  const mergeSources = [...base.sources];
  for (const s of patch.sources) {
    if (!mergeSources.some((x) => x.url.split("?")[0] === s.url.split("?")[0])) {
      mergeSources.push(s);
    }
  }

  return {
    ...base,
    updatedAt: new Date().toISOString(),
    researchPasses: (base.researchPasses || 0) + (patch.researchPasses || 0),
    summary: {
      who: patch.summary.who || base.summary.who,
      what: patch.summary.what || base.summary.what,
      when: patch.summary.when || base.summary.when,
      where: patch.summary.where || base.summary.where,
      why: patch.summary.why || base.summary.why,
      how: patch.summary.how || base.summary.how,
    },
    keyFacts: [...base.keyFacts, ...patch.keyFacts].filter(
      (f, i, arr) => arr.findIndex((x) => x.text === f.text) === i,
    ),
    actors: [...base.actors, ...patch.actors].filter(
      (a, i, arr) =>
        arr.findIndex((x) => x.name.toLowerCase() === a.name.toLowerCase()) === i,
    ),
    sources: mergeSources,
    primarySources: mergeSources.filter(
      (s) => s.type === "primary" || s.type === "official",
    ),
    secondarySources: mergeSources.filter((s) => s.type === "secondary"),
    secondaryAngleDivergences: uniq(
      base.secondaryAngleDivergences,
      patch.secondaryAngleDivergences,
    ),
    citations: [...base.citations, ...patch.citations].filter(
      (c, i, arr) => arr.findIndex((x) => x.quote === c.quote) === i,
    ),
    chronology: [...base.chronology, ...patch.chronology].filter(
      (e, i, arr) =>
        arr.findIndex(
          (x) => x.date === e.date && x.description === e.description,
        ) === i,
    ),
    history: {
      precedents: uniq(base.history.precedents, patch.history.precedents),
      similarCases: uniq(base.history.similarCases, patch.history.similarCases),
      politicalHistory: uniq(
        base.history.politicalHistory,
        patch.history.politicalHistory,
      ),
      judicialHistory: uniq(
        base.history.judicialHistory,
        patch.history.judicialHistory,
      ),
      mediaHistory: uniq(base.history.mediaHistory, patch.history.mediaHistory),
    },
    data: {
      statistics: uniq(base.data.statistics, patch.data.statistics),
      reports: uniq(base.data.reports, patch.data.reports),
      studies: uniq(base.data.studies, patch.data.studies),
      internationalComparisons: uniq(
        base.data.internationalComparisons,
        patch.data.internationalComparisons,
      ),
      budgets: uniq(base.data.budgets, patch.data.budgets),
      trends: uniq(base.data.trends, patch.data.trends),
    },
    politicalContext: {
      actors: uniq(base.politicalContext.actors, patch.politicalContext.actors),
      parties: uniq(base.politicalContext.parties, patch.politicalContext.parties),
      institutions: uniq(
        base.politicalContext.institutions,
        patch.politicalContext.institutions,
      ),
      consequences: uniq(
        base.politicalContext.consequences,
        patch.politicalContext.consequences,
      ),
    },
    legalContext: {
      laws: uniq(base.legalContext.laws, patch.legalContext.laws),
      caseLaw: uniq(base.legalContext.caseLaw, patch.legalContext.caseLaw),
      procedures: uniq(
        base.legalContext.procedures,
        patch.legalContext.procedures,
      ),
      investigations: uniq(
        base.legalContext.investigations,
        patch.legalContext.investigations,
      ),
      europeanTexts: uniq(
        base.legalContext.europeanTexts,
        patch.legalContext.europeanTexts,
      ),
    },
    reactions: {
      government: uniq(base.reactions.government, patch.reactions.government),
      opposition: uniq(base.reactions.opposition, patch.reactions.opposition),
      experts: uniq(base.reactions.experts, patch.reactions.experts),
      associations: uniq(
        base.reactions.associations,
        patch.reactions.associations,
      ),
      academics: uniq(base.reactions.academics, patch.reactions.academics),
      unions: uniq(base.reactions.unions, patch.reactions.unions),
      ngos: uniq(base.reactions.ngos, patch.reactions.ngos),
    },
    socialMedia: {
      officialPosts: uniq(
        base.socialMedia.officialPosts,
        patch.socialMedia.officialPosts,
      ),
      videos: uniq(base.socialMedia.videos, patch.socialMedia.videos),
      declarations: uniq(
        base.socialMedia.declarations,
        patch.socialMedia.declarations,
      ),
      viralElements: uniq(
        base.socialMedia.viralElements,
        patch.socialMedia.viralElements,
      ),
    },
    verification: [...base.verification, ...patch.verification].filter(
      (v, i, arr) => arr.findIndex((x) => x.claim === v.claim) === i,
    ),
    uncertainties: uniq(base.uncertainties, patch.uncertainties),
    missingInformation: uniq(
      base.missingInformation,
      patch.missingInformation,
    ),
    importance: {
      whyItMatters:
        patch.importance.whyItMatters || base.importance.whyItMatters,
      stakes: uniq(base.importance.stakes, patch.importance.stakes),
    },
    conceptsToExplain: [
      ...base.conceptsToExplain,
      ...patch.conceptsToExplain,
    ].filter(
      (c, i, arr) =>
        arr.findIndex((x) => x.term.toLowerCase() === c.term.toLowerCase()) ===
        i,
    ),
    glossary: [...base.glossary, ...patch.glossary].filter(
      (g, i, arr) =>
        arr.findIndex((x) => x.term.toLowerCase() === g.term.toLowerCase()) ===
        i,
    ),
    naiveQuestions: [...base.naiveQuestions, ...patch.naiveQuestions].filter(
      (q, i, arr) =>
        arr.findIndex(
          (x) => x.question.toLowerCase() === q.question.toLowerCase(),
        ) === i,
    ),
    articleQuestions: uniq(base.articleQuestions, patch.articleQuestions),
    graph: {
      nodes: [...base.graph.nodes, ...patch.graph.nodes].filter(
        (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i,
      ),
      edges: [...base.graph.edges, ...patch.graph.edges].filter(
        (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i,
      ),
    },
    extensions: {
      ...(base.extensions || {}),
      ...(patch.extensions || {}),
    },
    collectedDocuments: [
      ...(base.collectedDocuments || []),
      ...(patch.collectedDocuments || []),
    ].filter(
      (d, i, arr) => arr.findIndex((x) => x.url === d.url) === i,
    ),
  };
}
