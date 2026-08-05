/**
 * ResearchDossier — base de connaissances structurée (actif central).
 *
 * Règles dures :
 * - Aucune opinion, aucun ton Rempart, aucune prose journalistique.
 * - Uniquement des faits, sources, contextes, relations et incertitudes.
 * - Section absente > section inventée.
 * - schemaVersion permet d'évoluer sans casser les consommateurs.
 */

export const RESEARCH_DOSSIER_SCHEMA_VERSION = 2 as const;

/** @deprecated utiliser RESEARCH_DOSSIER_SCHEMA_VERSION */
export const RESEARCH_DOSSIER_VERSION = RESEARCH_DOSSIER_SCHEMA_VERSION;

export type ConfidenceLevel =
  | "confirmed"
  | "probable"
  | "contested"
  | "unverifiable";

/** Alias historique — aligné sur ConfidenceLevel. */
export type VerificationStatus = ConfidenceLevel | "false" | "unknown";

export type SourceType = "primary" | "secondary" | "social" | "official";

/**
 * Source riche — unité documentaire réutilisable par tous les agents futurs.
 */
export type SourceDocument = {
  url: string;
  title: string;
  publisher?: string;
  language?: string;
  publicationDate?: string;
  retrievedAt: string;
  type: SourceType;
  scraped: boolean;
  /** 0–1 : fiabilité / pertinence estimée (influencee par la hiérarchie source-first). */
  confidence: number;
  /** Tier 1–10 (1 = document officiel … 10 = social non vérifié). */
  tier?: number;
  angle?: string;
  notes?: string;
  excerpt?: string;
};

/** @deprecated préférer SourceDocument */
export type SourceRef = SourceDocument;

export type ActorKind =
  | "principal"
  | "secondary"
  | "institution"
  | "organization"
  | "company"
  | "association"
  | "concerned_person";

export type ResearchActor = {
  name: string;
  kind: ActorKind;
  role: string;
  partyOrAffiliation?: string;
  notes?: string;
  confidence?: ConfidenceLevel;
  nodeId?: string;
};

/**
 * Fait important traçable jusqu'à la preuve.
 */
export type KnowledgeFact = {
  text: string;
  confidence: ConfidenceLevel;
  /** URLs des sources qui mentionnent / confirment ce fait. */
  sourceUrls: string[];
  /** Nombre de sources distinctes qui le confirment. */
  confirmingSourceCount: number;
  /** Preuve principale (souvent la source au meilleur tier). */
  primaryEvidenceUrl?: string;
  nodeId?: string;
};

export type Citation = {
  quote: string;
  author: string;
  date?: string;
  context?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  confidence?: ConfidenceLevel;
};

export type ChronologyEvent = {
  date: string;
  description: string;
  confidence: ConfidenceLevel;
  sourceUrl?: string;
  sourceUrls?: string[];
  nodeId?: string;
};

export type ConceptToExplain = {
  term: string;
  whyNeeded: string;
  shortDefinition: string;
};

export type GlossaryEntry = {
  term: string;
  definition: string;
};

export type NaiveQuestion = {
  question: string;
  answer?: string;
  unanswered: boolean;
  confidence?: ConfidenceLevel;
};

export type VerifiedClaim = {
  claim: string;
  status: ConfidenceLevel;
  notes?: string;
  sourceUrl?: string;
  sourceUrls?: string[];
};

export type CollectedDocument = {
  url: string;
  title?: string;
  excerpt: string;
  fetchedAt: string;
  publisher?: string;
  type?: SourceType;
};

/** Couverture 0–100 % par dimension — guide l'enrichissement. */
export type DossierCoverage = {
  facts: number;
  chronology: number;
  primarySources: number;
  context: number;
  reactions: number;
  history: number;
  legal: number;
  statistics: number;
  overall: number;
};

export type DossierQualityScores = {
  facts: number;
  sources: number;
  chronology: number;
  history: number;
  context: number;
  legal: number;
  statistics: number;
  reactions: number;
  actors: number;
  concepts: number;
  overall: number;
};

/** Graphe de connaissances (relations explicites entre éléments). */
export type KnowledgeNodeType =
  | "actor"
  | "event"
  | "document"
  | "claim"
  | "institution"
  | "reaction"
  | "concept";

export type KnowledgeEdgeType =
  | "declares"
  | "participates_in"
  | "causes"
  | "reacts_to"
  | "based_on"
  | "confirms"
  | "contests"
  | "related_to";

export type KnowledgeNode = {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  confidence?: ConfidenceLevel;
};

export type KnowledgeEdge = {
  id: string;
  from: string;
  to: string;
  type: KnowledgeEdgeType;
  label?: string;
  confidence?: ConfidenceLevel;
  sourceUrls?: string[];
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

/**
 * Sections futures sans modifier le pipeline :
 * biographies, faq, jurisprudence enrichie, bibliographie, etc.
 */
export type DossierExtensions = Record<string, unknown>;

export type ResearchDossier = {
  schemaVersion: typeof RESEARCH_DOSSIER_SCHEMA_VERSION;
  /** Alias de compatibilité (= schemaVersion). */
  version: typeof RESEARCH_DOSSIER_SCHEMA_VERSION;

  subject: string;
  generatedAt: string;
  updatedAt?: string;
  sourceUrl?: string;
  researchPasses?: number;

  summary: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
    how: string;
  };

  keyFacts: KnowledgeFact[];
  actors: ResearchActor[];

  sources: SourceDocument[];
  primarySources: SourceDocument[];
  secondarySources: SourceDocument[];
  secondaryAngleDivergences: string[];

  citations: Citation[];
  chronology: ChronologyEvent[];

  history: {
    precedents: string[];
    similarCases: string[];
    politicalHistory: string[];
    judicialHistory: string[];
    mediaHistory: string[];
  };

  data: {
    statistics: string[];
    reports: string[];
    studies: string[];
    internationalComparisons: string[];
    budgets: string[];
    trends: string[];
  };

  politicalContext: {
    actors: string[];
    parties: string[];
    institutions: string[];
    consequences: string[];
  };

  legalContext: {
    laws: string[];
    caseLaw: string[];
    procedures: string[];
    investigations: string[];
    europeanTexts: string[];
  };

  reactions: {
    government: string[];
    opposition: string[];
    experts: string[];
    associations: string[];
    academics: string[];
    unions: string[];
    ngos: string[];
  };

  socialMedia: {
    officialPosts: string[];
    videos: string[];
    declarations: string[];
    viralElements: string[];
  };

  verification: VerifiedClaim[];
  uncertainties: string[];
  missingInformation: string[];

  importance: {
    whyItMatters: string;
    stakes: string[];
  };

  conceptsToExplain: ConceptToExplain[];
  glossary: GlossaryEntry[];
  naiveQuestions: NaiveQuestion[];
  articleQuestions: string[];

  /** Relations explicites entre acteurs, événements, documents, réactions. */
  graph: KnowledgeGraph;

  quality?: DossierQualityScores;
  qualityNotes?: string[];
  coverage?: DossierCoverage;
  lastDiagnostic?: {
    ready: boolean;
    missing: string[];
    nextQueries: string[];
  };

  collectedDocuments?: CollectedDocument[];

  /**
   * Extension ouverte — nouvelles sections sans changer le pipeline.
   * Ex. : biographies, faq, bibliography, detailedChronology…
   */
  extensions?: DossierExtensions;
};

export function emptyResearchDossier(
  subject: string,
  sourceUrl?: string,
): ResearchDossier {
  return {
    schemaVersion: RESEARCH_DOSSIER_SCHEMA_VERSION,
    version: RESEARCH_DOSSIER_SCHEMA_VERSION,
    subject,
    generatedAt: new Date().toISOString(),
    sourceUrl,
    researchPasses: 0,
    summary: { who: "", what: "", when: "", where: "", why: "", how: "" },
    keyFacts: [],
    actors: [],
    sources: [],
    primarySources: [],
    secondarySources: [],
    secondaryAngleDivergences: [],
    citations: [],
    chronology: [],
    history: {
      precedents: [],
      similarCases: [],
      politicalHistory: [],
      judicialHistory: [],
      mediaHistory: [],
    },
    data: {
      statistics: [],
      reports: [],
      studies: [],
      internationalComparisons: [],
      budgets: [],
      trends: [],
    },
    politicalContext: {
      actors: [],
      parties: [],
      institutions: [],
      consequences: [],
    },
    legalContext: {
      laws: [],
      caseLaw: [],
      procedures: [],
      investigations: [],
      europeanTexts: [],
    },
    reactions: {
      government: [],
      opposition: [],
      experts: [],
      associations: [],
      academics: [],
      unions: [],
      ngos: [],
    },
    socialMedia: {
      officialPosts: [],
      videos: [],
      declarations: [],
      viralElements: [],
    },
    verification: [],
    uncertainties: [],
    missingInformation: [],
    importance: { whyItMatters: "", stakes: [] },
    conceptsToExplain: [],
    glossary: [],
    naiveQuestions: [],
    articleQuestions: [],
    graph: { nodes: [], edges: [] },
    collectedDocuments: [],
    extensions: {},
  };
}
