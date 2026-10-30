/**
 * Moteur « brief » (repris du bot Flambeau) : l'éditeur décrit le sujet en texte libre,
 * Kimi choisit lui-même ses recherches web (/v1/tools/search), puis rédige le flash
 * Facebook et l'article du site à partir des mêmes sources.
 */

import sharp from "sharp";
import { claudeChatTurn, isClaudeConfigured } from "@/lib/claude-fallback";
import { researchSubject } from "@/lib/claude-research";
import { recordTokenUsage } from "@/lib/eval/token-meter";
import { fetchSourceText, scrubBoilerplate } from "@/lib/fetch-source";
import { outletFromUrl } from "@/lib/flash-info";
import { fixFrenchPunctuation } from "@/lib/french-copy";
import {
  AUDIT_SYSTEM,
  fixOcrNumero,
  parseAudit,
  unverifiedQuotes,
  type AuditProblem,
} from "@/lib/fact-check";
import {
  enforceLinks,
  outsideLinkTargets,
  stripSourcesSection,
  type LinkPolicy,
} from "@/lib/article-links";
import { italicizeCitations } from "@/lib/italicize-citations";

const BASE = "https://api.moonshot.ai/v1";
const MODEL = process.env.KIMI_MODEL || "kimi-k3";
/**
 * Réglages Kimi. Mesuré sur un article de ~750 mots : k3 par défaut 125 s (5 500 tokens
 * de réflexion), k3 en réflexion courte 30 s, k2.6 sans réflexion 19 s.
 * Le flash garde la réflexion complète ; l'article part en réflexion courte.
 */
type Mode = "deep" | "low" | "fast";
const MODE_TIMEOUT_MS: Record<Mode, number> = {
  deep: 240_000,
  low: 150_000,
  fast: 120_000,
};
/** En cas de timeout, on relance une fois dans le mode suivant. */
const FALLBACK: Record<Mode, Mode> = { deep: "low", low: "fast", fast: "fast" };
/** Recherche + rédaction ; le reste des 800 s Vercel sert à l'article en base et à Facebook. */
const TOTAL_BUDGET_MS = 700_000;
/** Au-delà, on repasse à la recherche par Kimi pour que la publication reste possible. */
const OPUS_RESEARCH_TIMEOUT_MS = 300_000;
/** Temps qu'il doit rester pour lancer la relecture, correction comprise. */
const AUDIT_MIN_LEFT_MS = 120_000;
const AUDIT_RECHECK_MIN_LEFT_MS = 60_000;
const AUDIT_MAX_PROBLEMS = 8;

export const FLASH_PREFIX = "‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 —";
const FLASH_MIN_WORDS = 60;
const FLASH_MAX_WORDS = 200;
const ARTICLE_MIN_WORDS = 300;
/** Au-delà, Google tronque le titre et le chapô (repris en meta description). */
const TITLE_MAX_CHARS = 100;
const EXCERPT_MAX_CHARS = 240;
const ARTICLE_MIN_HEADINGS = 2;
/** La consigne dit 60 mots : la marge laisse passer une longue citation. */
const PARAGRAPH_MAX_WORDS = 80;

export type BriefSource = { url: string; title: string; date?: string };

export type BriefResult = {
  flash: string;
  article: { title: string; excerpt: string; content: string };
  sources: BriefSource[];
  /** Matière brute lue (pour article.sourceText). */
  matter: string;
  /** Points à revoir par l'éditeur, faute d'avoir pu être corrigés. */
  warnings: string[];
};

const EDITORIAL_LINE = `LIGNE ÉDITORIALE
- Sensibilité de droite assumée : attachement à l'ordre et à l'autorité de l'État, fermeté sur l'immigration et la délinquance, souveraineté nationale, identité et héritage français, valeur du travail, défense du contribuable, soutien aux forces de l'ordre et au monde agricole, scepticisme envers la gauche, l'assistanat et les renoncements de l'exécutif.
- Cette orientation est assumée. Elle passe d'abord par le choix des faits mis en avant, leur ordre, un chiffre placé au bon endroit, une citation bien choisie, un mot juste plutôt qu'un mot fort. Elle peut aussi se dire franchement, dans les phrases de regard décrites plus bas, jamais à la place des faits.
- La dénonciation est permise, mais elle est sobre, argumentée et habile : un constat précis vaut mieux qu'une indignation.
- Ton grave et sérieux du début à la fin. Aucun humour, aucun sarcasme, aucun cynisme, aucune ironie facile, aucun jeu de mots, aucune formule de comptoir.
- Les consignes de l'éditeur fixent le sujet et l'angle. Les faits, eux, viennent uniquement des consignes, de la créative et de tes recherches : ne jamais inventer de fait, de chiffre, de citation, de nom ou de date. Si une information n'est pas confirmée par tes recherches, attribue-la ("selon …", "d'après les premiers éléments"). Si tes recherches contredisent un détail des consignes (une peine, un chiffre, une date), c'est la version des sources qui fait foi.
- Pas d'accusation nominative non étayée, pas d'insulte ni d'appel à la haine ou à la violence.
- Reste dans le périmètre du sujet. Ne rattache pas une affaire à un autre fait divers ou à un groupe de population sans lien factuel direct, établi par tes sources. La nationalité, l'origine ou le statut d'une personne se mentionne quand il fait partie du fait rapporté.
- Pas de généralisation (« dans certains quartiers », « dans certaines bouches ») ni d'affirmation absolue invérifiable (« jamais », « toujours », « aucun ») sans source précise.

CITER UN MÉDIA
- Un média n'est nommé que lorsqu'il est réellement à l'origine de l'information : exclusivité ou révélation, document qu'il a obtenu, enquête ou chiffres qu'il a produits, interview qu'il a lui-même menée, propos tenus sur son antenne ou dans ses colonnes (« au micro de RMC », « interrogés par CNEWS », « révèle Le Parisien »). Dans ce cas, reprends entre guillemets un ou deux fragments exacts de son article.
- Tout ce qui est public s'écrit comme un fait établi, sans « rapporte X », « souligne Y », « selon Z », « indique W » : débats et votes au Parlement, déclarations publiques, communiqués, conférences de presse, audiences et décisions publiques, chiffres officiels, faits de notoriété publique et antécédents déjà connus d'une personnalité. Un ministre qui parle dans l'hémicycle n'a pas besoin d'un média pour exister.
- En cas de doute, demande-toi si l'information existerait sans ce média. Si oui, ne le cite pas.

STYLE
- Un vrai français écrit, élégant et précis : phrases construites et variées, de longueurs différentes, subordonnées maîtrisées, vocabulaire juste et soutenu sans préciosité, enchaînements logiques naturels.
- L'information principale d'abord (qui, quoi, où, quand), puis le contexte, puis la mise en perspective.
- Le texte ne doit jamais sentir la rédaction automatique. Proscris en particulier :
  · les tics d'IA et de réseau social : "Une chose est sûre", "Force est de constater", "Le message est clair", "Rappel des faits", "Résultat :", "Pendant ce temps", "Pendant que…", "Jusqu'à quand ?", "Plus que jamais", "Ni plus ni moins", "Et ce n'est pas tout", "coup de théâtre", "la colère gronde", "en trompe-l'œil", "véritable", "il est important de noter", "dans un contexte de", "on notera", "on croit rêver", "les Français apprécieront", "Reste que", "Reste à savoir", "Par ces mots", "moins X que Y", "bien plus qu'un…", "loin d'être clos" ;
  · la paraphrase d'une citation : une déclaration se suffit, ne l'explique pas dans la phrase suivante ;
  · les énumérations systématiques par trois, les phrases nominales en rafale, les points d'exclamation, les majuscules d'emphase, les guillemets ironiques ;
  · les formules creuses, emphatiques ou racoleuses.
- Typographie française : espace avant « : », « ; », « ! », « ? ». Guillemets français « … ».
- AUCUN tiret de ponctuation : ni « - », ni « – », ni « — ». Pour une incise ou une pause, utilise une virgule, deux-points, des parenthèses ou un point. Seuls les traits d'union à l'intérieur des mots sont permis (Saint-Denis, peut-être).
- Aucun emoji, aucun hashtag.`;

const VOICE = `LA VOIX DU REMPART
Tout le site est écrit d'une seule plume, celle de Dimitri Scudo. On doit la reconnaître sans lire la signature. Sa règle : « Un article du Rempart peut prendre parti. Il ne doit jamais arranger les faits. »
- Le concret d'abord. Un chiffre se traduit en ce qu'il coûte et à qui. Une décision se raconte par ceux qui la subissent : la victime avant le mis en cause, le contribuable, le policier, l'agriculteur, le commerçant. Pas d'abstraction là où un visage, une somme ou un lieu existe.
- Le rythme de la plume : une phrase longue et construite qui expose, puis une phrase brève et sèche qui fixe le fait. Ce contraste revient à chaque section, sans devenir un procédé.
- La mémoire : quand tes sources le permettent, rappelle ce qui avait été promis, voté ou déclaré auparavant, avec sa date. L'écart entre le discours et le réel est le terrain favori du Rempart.
- Le détail qui dit tout : choisis dans les sources le fait précis que les autres ont laissé de côté et place-le où il pèse.
- Le regard : chaque texte porte une ou deux phrases qui disent franchement ce que les faits signifient, comme « Chaque euro public sort de la poche de quelqu'un » ou « La sécurité est la première des libertés ». Ces deux exemples montrent le registre : ne les réutilise pas. Une phrase de regard est courte, affirmative, sans question rhétorique, et s'appuie sur le fait donné juste avant. Jamais dans le premier paragraphe, jamais comme dernière phrase, jamais seule dans un paragraphe. Elle n'apporte aucun fait nouveau, ne prête aucune intention à personne et ne décrit pas une situation générale. Elle ne glisse jamais vers l'ironie (« visiblement », « curieusement », « comme par hasard »). Le flash et l'article n'utilisent pas la même.
- Les mots de la maison : simples, français, exacts. Dis « contribuable » plutôt que « citoyen fiscal », « clandestin » seulement si la situation est établie, jamais de jargon administratif ni d'anglicisme sans nécessité.
- Une voix forte reste une voix tenue : pas d'insulte, pas de mépris envers une population, pas d'emphase. La force vient de la précision.
- La critique vise un acte, un chiffre ou une décision précise, jamais un camp en général. Pas de pique du type « un principe que la gauche oublie à plaisir » ou « cette majorité introuvable ».`;

const FLASH_SYSTEM = `Tu es le rédacteur en chef de la page Facebook du "Rempart", un média d'actualité française à la ligne éditoriale ancrée à droite. Tu écris comme un journaliste chevronné de la presse quotidienne nationale, pas comme une intelligence artificielle ni comme un animateur de réseau social.

TA MÉTHODE
1. Regarde la créative (son accroche résume le sujet) et lis les consignes de l'éditeur : elles définissent le sujet et l'angle, elles priment sur tout.
2. Fais des recherches web (outil web_search) pour vérifier les faits et récupérer les éléments précis : qui, quoi, où, quand, chiffres, déclarations. Privilégie l'actualité la plus récente et plusieurs sources. Lance tes requêtes en parallèle (plusieurs appels d'outil dans la même réponse), 5 requêtes au total au maximum, puis rédige sans tarder. Ces recherches serviront aussi à l'article complet du site : couvre les faits, le contexte et les réactions.
3. Rédige le Flash info.

${EDITORIAL_LINE}

${VOICE}

FORMAT DU FLASH
- Le texte commence EXACTEMENT par : ${FLASH_PREFIX} puis enchaîne directement sur l'information principale, sur la même ligne.
- Longueur : entre ${FLASH_MIN_WORDS} et ${FLASH_MAX_WORDS} mots, selon la matière disponible. Un fait simple appelle un texte bref ; un sujet riche, deux ou trois paragraphes séparés par une ligne vide.
- La dernière phrase conclut par un fait marquant ou un constat sobre qui donne à réfléchir. Pas de question rhétorique, pas d'interpellation du lecteur, pas de slogan.
- Pas de titres, pas de gras, pas de liens, pas d'URL ni de nom de domaine, pas de liste à puces.
- Après le texte, ajoute une dernière ligne séparée : SOURCES : suivie des noms des un ou deux médias dont viennent l'essentiel des faits (ex. SOURCES : Le Figaro, BFMTV). Cette ligne sera mise en forme automatiquement.
- Réponds UNIQUEMENT avec le texte du post puis la ligne SOURCES, sans guillemets ni commentaire.`;

const ARTICLE_SYSTEM = `Tu es journaliste au "Rempart", un média d'actualité française à la ligne éditoriale ancrée à droite. Tu écris l'article complet du site sur le sujet du Flash info déjà publié, comme un journaliste chevronné de la presse quotidienne nationale.

TA MÉTHODE
1. Tu disposes des consignes de l'éditeur, du flash et des sources déjà lues. Si un point important manque (contexte, antécédents, réactions), tu peux faire au plus 3 recherches web supplémentaires (outil web_search), en parallèle, puis rédiger sans tarder.
2. Rédige l'article.

${EDITORIAL_LINE}

${VOICE}

FORMAT DE L'ARTICLE
- Le corps est en Markdown : 2 à 4 intertitres "## ", des paragraphes construits, très peu de **gras**, aucune liste à puces.
- Paragraphes courts pour la lecture sur mobile : 60 mots au plus chacun (deux à quatre phrases). Coupe un développement long en deux paragraphes plutôt que de l'allonger.
- Longueur : de 400 à 900 mots selon la matière. Un sujet pauvre donne un article plus court, jamais du remplissage.
- Ouverture : le premier paragraphe se suffit à lui-même. Il répond à qui, quoi, où et quand, avec le nom complet, la fonction et la date exacte (« jeudi 29 octobre »), de sorte qu'un moteur de recherche ou un assistant puisse le reprendre tel quel. Il ne recopie pas le chapô.
- Raconte, ne recopie pas. Tu écris pour un lecteur qui arrive de Facebook et ne connaît pas la procédure. Ouvre sur ce qui s'est passé et sur qui s'oppose à qui, pas sur la procédure : « Philippe Juvin dénonce une taxe à 91,8 % », pas « L'amendement n° 40 a été rejeté ».
- Trie la matière : le dossier contient plus que ce qu'il faut publier. Garde ce qui compte pour le lecteur (qui, combien, ce que ça change pour lui, qui gagne et qui perd). Écarte les numéros d'amendement, de texte ou d'article, les sigles et le jargon de procédure, sauf s'ils sont indispensables, et explique alors le terme en quelques mots.
- Suite : le déroulé, le contexte, les réactions nommées, la mise en perspective.
- Si le dossier contredit les consignes de l'éditeur, écris simplement la version exacte, sans le signaler dans l'article (pas de « contrairement à ce qui a pu circuler »).
- Fin : termine sur un fait (prochaine échéance, réaction, décision attendue, chiffre), jamais sur un commentaire ou une morale.
- Intertitres : on doit comprendre l'article en ne lisant qu'eux. Chacun nomme le fait, la personne ou l'institution traités. Un ou deux peuvent reprendre la question que se pose le lecteur (« Que reproche Christine Kelly à l'Arcom ? »). Pas de formule ni d'effet de style (« Une leçon d'histoire », « Des railleries qui disent autre chose »), et rien qu'un lecteur ordinaire ne comprendrait pas (« Un budget qui s'écrira au solennel »).
- Chaque section se comprend isolément : reprends le nom plutôt qu'un pronom au début de section, et donne les dates et les chiffres en entier, avec leur auteur.
- Apporte ce que les autres n'ont pas : fait daté, chiffre, antécédent, citation exacte. Pas de paraphrase de dépêche.
- Emploie naturellement les mots que le lecteur taperait dans un moteur de recherche, sans répétition artificielle.
- Citations verbatim courtes, entre guillemets français et en italique : *« phrase exacte »*, toujours attribuées à la personne qui les a prononcées. N'attribue à un média que ce qu'il a réellement écrit, et seulement quand il est à l'origine de l'information (voir « CITER UN MÉDIA »).
- Titre : ${TITLE_MAX_CHARS} caractères au plus, idéalement moins de 90. Le nom de la personne, de l'institution ou du lieu principal dans les premiers mots, puis le fait, sur le même sujet que l'accroche de la créative, avec les chiffres exacts des sources. Il annonce exactement ce que contient l'article : pas d'énigme, pas de promesse que le texte ne tient pas. Pas de majuscules partout, pas de point final.
- Chapô (excerpt) : une ou deux phrases strictement factuelles, ${EXCERPT_MAX_CHARS} caractères au plus, idéalement 130 à 200. L'essentiel tient dans les 150 premiers caractères, car c'est ce que montrent les résultats de recherche.

LIENS DANS LE CORPS (Markdown)
- Liens vers la presse : uniquement quand le texte renvoie explicitement à un article précis d'un média (« a-t-il déclaré sur BFMTV », « révèle Le Parisien », « selon un document consulté par Le Figaro »). Le lien porte alors sur le nom du média, discrètement : a-t-il déclaré sur [BFMTV](https://…). Utilise UNIQUEMENT les adresses de la liste « Sources déjà lues » ou celles renvoyées par tes recherches, recopiées à l'identique. Sinon, pas de lien vers la presse. Jamais de lien vers un réseau social (Instagram, Facebook, X, TikTok, YouTube, Telegram).
- Liens vers les documents officiels : quand l'article s'appuie sur un document public précis (compte rendu de séance, décision de justice, rapport, Journal officiel, texte de loi, délibération), mets un lien vers ce document, sur quelques mots qui le décrivent : le [compte rendu de la séance](https://…). Uniquement une adresse présente dans le dossier ou les sources, recopiée à l'identique. Un à deux liens suffisent.
- Liens internes : si la liste « Articles du Rempart sur des sujets proches » est fournie, place dans le texte un à trois liens vers ceux qui éclairent vraiment le sujet (antécédents, affaire liée, même personne). C'est attendu dès qu'un article de la liste porte sur la même personne ou la même affaire. L'ancre fait 3 à 8 mots, s'intègre à une phrase et décrit l'article lié, par exemple : la [condamnation du député en 2025](/articles/123). Jamais le titre complet, jamais « cliquez ici ». Recopie l'adresse /articles/… telle quelle. N'en mets aucun si rien n'est pertinent, et ne dévie pas du sujet pour en placer un.
- Jamais d'adresse inventée, jamais de lien nu, jamais de section ou de liste de sources.
- Réponds UNIQUEMENT avec un JSON valide : {"title":"...","excerpt":"...","content":"..."}`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Recherche sur le web (actualité, faits, chiffres, déclarations). Renvoie titres, URLs, dates et extraits des pages.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Requête de recherche, de préférence en français.",
          },
        },
        required: ["query"],
      },
    },
  },
];

type ToolCall = { id: string; function: { name: string; arguments?: string } };
type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: unknown;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  /** Réponse Claude d'origine, gardée telle quelle pour le tour suivant. */
  claudeContent?: unknown;
};

type SearchHit = {
  title?: string;
  url?: string;
  site_name?: string;
  date?: string;
  snippet?: string;
  text?: string;
  error?: string;
};

type Hooks = {
  onSearch?: (queries: string[]) => void | Promise<void>;
  onProgress?: (msg: string) => void | Promise<void>;
};

/** Recherche, flash puis article, sur un brief libre de l'éditeur. */
export async function researchAndWrite(input: {
  /** Accroche lue sur la créative Canva. */
  headline: string;
  /** Consignes libres de l'éditeur (sujet, angle, noms, liens…). */
  brief: string;
  creative?: { buffer: Buffer; mime: string };
  /** Articles déjà publiés sur des sujets proches, proposés en liens internes. */
  linkable?: Array<{ publicId: number; title: string }>;
} & Hooks): Promise<BriefResult> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  // Passe à Claude pour toute la suite dès que Kimi refuse le sujet.
  const engine: Engine = { claude: false };
  const sources = new Map<string, BriefSource>();
  const notes = new Map<string, string>();

  // Les liens collés dans le brief sont lus d'office (en plus des recherches de Kimi).
  const provided = await readProvidedLinks(input.brief, input.onProgress);
  for (const p of provided) {
    sources.set(p.url, { url: p.url, title: p.title });
    notes.set(p.url, p.text);
  }

  const briefBlock = [
    input.headline ? `Accroche de la créative : ${input.headline}` : "",
    `Consignes de l'éditeur :\n${input.brief}`,
    ...provided.map(
      (p) => `Page fournie par l'éditeur (${p.url}) :\n"""${p.text}"""`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Tout ce que l'agent a réellement lu : une citation doit s'y trouver.
  const lu = () => [briefBlock, ...notes.values()].join("\n");

  const warnings: string[] = [];
  const creativeUrl = input.creative ? await imageDataUrl(input.creative) : "";
  const dossier = await opusDossier({
    brief: briefBlock,
    creativeUrl,
    sources,
    notes,
    warnings,
    onProgress: input.onProgress,
  });
  const writerBlock = dossier
    ? `${briefBlock}\n\nDOSSIER DE RECHERCHE établi par le chercheur du Rempart. C'est ta seule matière factuelle : n'ajoute aucun fait et ne cite que les phrases de sa rubrique CITATIONS EXACTES, mot pour mot.\n"""${dossier}"""`
    : briefBlock;

  const userContent: unknown = creativeUrl
    ? [
        { type: "image_url", image_url: { url: creativeUrl } },
        { type: "text", text: writerBlock },
      ]
    : writerBlock;

  await input.onProgress?.("🔎 Recherches et rédaction du flash…");
  const flashRaw = await runAgent({
    system: FLASH_SYSTEM,
    messages: [{ role: "user", content: userContent }],
    maxRounds: 6,
    mode: "deep",
    noTools: Boolean(dossier),
    engine,
    sources,
    notes,
    onSearch: input.onSearch,
    onProgress: input.onProgress,
    deadline,
    check: (raw) => {
      const { body } = splitFlash(raw);
      return [...flashIssues(body), ...quoteIssues(body, lu())];
    },
  });
  const flash = finishFlash(flashRaw, provided[0]?.url);

  const linkable = input.linkable || [];
  // Relu à chaque appel : les recherches faites pendant l'article ajoutent des sources.
  const linkPolicy = (): LinkPolicy => ({
    external: new Set(sources.keys()),
    internal: new Set(linkable.map((a) => a.publicId)),
  });

  const articleCheck = (raw: string): string[] => {
    try {
      const parsed = parseArticle(raw);
      return [
        ...articleIssues(parsed),
        ...quoteIssues(`${parsed.excerpt}\n${parsed.content}`, lu()),
      ];
    } catch (err) {
      return [err instanceof Error ? err.message : "JSON invalide"];
    }
  };
  const articleRequest = [
    writerBlock,
    `Flash info publié sur Facebook :\n"""${flash}"""`,
    `Sources déjà lues :\n${digest(sources, notes)}`,
    linkable.length
      ? `Articles du Rempart sur des sujets proches :\n${linkable
          .map((a) => `- ${a.title} : /articles/${a.publicId}`)
          .join("\n")}`
      : "",
    "Rédige l'article complet du site.",
  ]
    .filter(Boolean)
    .join("\n\n");

  await input.onProgress?.("✍️ Rédaction de l'article du site…");
  let articleRaw = await runAgent({
    system: ARTICLE_SYSTEM,
    messages: [{ role: "user", content: articleRequest }],
    maxRounds: 4,
    mode: "low",
    noTools: Boolean(dossier),
    engine,
    sources,
    notes,
    onSearch: input.onSearch,
    onProgress: input.onProgress,
    deadline,
    check: articleCheck,
  });

  // Relecteur différent du rédacteur quand Opus répond ; sinon, même moteur qu'avant.
  const auditEngine = dossier ? { claude: true } : engine;
  if (deadline - Date.now() < AUDIT_MIN_LEFT_MS) {
    warnings.push("Relecture des faits sautée, faute de temps.");
  } else {
    try {
      await input.onProgress?.("🧐 Relecture des faits…");
      const matter = [writerBlock, digest(sources, notes, 2000, 40_000)].join("\n\n");
      const problems = await auditClaims({
        article: parseArticle(articleRaw),
        matter,
        engine: auditEngine,
        deadline,
      });
      if (problems.length) {
        await input.onProgress?.(
          `✂️ ${problems.length} passage(s) non étayé(s), correction :\n${problems
            .map((p) => `• ${p.passage}`)
            .join("\n")}`,
        );
        articleRaw = await runAgent({
          system: ARTICLE_SYSTEM,
          messages: [
            { role: "user", content: articleRequest },
            { role: "assistant", content: articleRaw },
            {
              role: "user",
              content: `La relecture a relevé des passages que les sources n'étayent pas :\n${problems
                .map((p) => `- « ${p.passage} » : ${p.raison}`)
                .join("\n")}\n\nRetire chacun de ces passages ou ramène-le à ce que disent les sources, sans ajouter aucun fait. Ne change rien d'autre et garde la voix du texte. Réponds avec le JSON complet.`,
            },
          ],
          maxRounds: 2,
          mode: "low",
          noTools: Boolean(dossier),
          engine,
          sources,
          notes,
          onProgress: input.onProgress,
          deadline,
          check: articleCheck,
        });
        // Seconde lecture : ce qui reste est signalé, sans nouvelle réécriture.
        if (deadline - Date.now() >= AUDIT_RECHECK_MIN_LEFT_MS) {
          const left = await auditClaims({
            article: parseArticle(articleRaw),
            matter,
            engine: auditEngine,
            deadline,
          });
          warnings.push(...left.map((p) => `Passage à vérifier : « ${p.passage} » (${p.raison})`));
        } else {
          warnings.push("Seconde relecture sautée, faute de temps.");
        }
      }
    } catch (err) {
      console.error("relecture des faits", err);
      warnings.push("Relecture des faits interrompue : article non revérifié.");
    }
  }

  const article = finishArticle(parseArticle(articleRaw), linkPolicy());
  for (const quote of unverifiedQuotes(
    `${flash}\n${article.excerpt}\n${article.content}`,
    lu(),
  )) {
    warnings.push(`Citation introuvable dans les sources : « ${quote} »`);
  }

  return {
    flash,
    article,
    warnings,
    sources: [...sources.values()],
    matter: [
      `Consignes de l'éditeur : ${input.brief}`,
      dossier && `Dossier de recherche d'Opus :\n${dossier}`,
      digest(sources, notes),
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Dossier d'Opus, ou chaîne vide : Kimi fait alors ses recherches comme avant. */
async function opusDossier(input: {
  brief: string;
  creativeUrl: string;
  sources: Map<string, BriefSource>;
  notes: Map<string, string>;
  warnings: string[];
  onProgress?: Hooks["onProgress"];
}): Promise<string> {
  if (!isClaudeConfigured()) return "";
  await input.onProgress?.("🔬 Opus enquête sur ton sujet…");
  try {
    const research = await researchSubject({
      brief: input.brief,
      imageBase64: input.creativeUrl.split(",")[1],
      today: new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
      }),
      timeoutMs: OPUS_RESEARCH_TIMEOUT_MS,
    });
    for (const s of research.sources) input.sources.set(s.url, s);
    for (const [url, text] of research.pages) input.notes.set(url, text);
    input.notes.set("dossier:opus", research.dossier);
    await input.onProgress?.(
      `📂 Dossier prêt : ${research.usage.searches} recherches, ${research.usage.fetches} pages lues en entier.`,
    );
    return research.dossier;
  } catch (err) {
    console.error("recherche opus", err);
    input.warnings.push("Recherche Opus indisponible : Kimi a cherché à sa place.");
    await input.onProgress?.("⚠️ Opus indisponible : Kimi reprend la recherche.");
    return "";
  }
}

/** Relecture indépendante de la rédaction : ne sait que comparer l'article aux sources. */
export async function auditClaims(input: {
  article: { title: string; excerpt: string; content: string };
  matter: string;
  engine?: { claude: boolean };
  deadline?: number;
}): Promise<AuditProblem[]> {
  const raw = await runAgent({
    system: AUDIT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `SOURCES :\n${input.matter}\n\nARTICLE À VÉRIFIER :\n${input.article.title}\n\n${input.article.excerpt}\n\n${input.article.content}`,
      },
    ],
    maxRounds: 1,
    mode: "low",
    engine: input.engine || { claude: false },
    sources: new Map(),
    notes: new Map(),
    deadline: input.deadline ?? Date.now() + 240_000,
    check: () => [],
  });
  return parseAudit(raw).slice(0, AUDIT_MAX_PROBLEMS);
}

function quoteIssues(text: string, matter: string): string[] {
  return unverifiedQuotes(text, matter).map(
    (q) =>
      `la citation « ${q} » ne figure pas dans ce que tu as lu : retire-la ou reprends une phrase exacte des sources`,
  );
}

// --- Boucle agent -------------------------------------------------------------

type Engine = { claude: boolean };

const KIMI_REFUSAL = /Kimi a bloqué ce sujet/;
const CLAUDE_TIMEOUT_MS = 240_000;

async function runAgent(input: {
  system: string;
  messages: ChatMessage[];
  maxRounds: number;
  mode: Mode;
  engine: Engine;
  onProgress?: Hooks["onProgress"];
  deadline: number;
  sources: Map<string, BriefSource>;
  notes: Map<string, string>;
  onSearch?: Hooks["onSearch"];
  /** Problèmes de format à renvoyer à Kimi ; liste vide = texte accepté. */
  check: (raw: string) => string[];
  /** Le dossier est fourni : pas de recherche web pour le rédacteur. */
  noTools?: boolean;
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: input.system + dateNote() },
    ...input.messages,
  ];

  for (let round = 0; round < input.maxRounds; round++) {
    const isLast = round === input.maxRounds - 1;
    const useTools = !isLast && !input.noTools;
    let msg: ChatMessage;
    const fallback = FALLBACK[input.mode];
    try {
      msg = input.engine.claude
        ? await claudeChatTurn({
            messages,
            tools: TOOLS,
            allowTools: useTools,
            timeoutMs: claudeBudget(input.deadline),
          })
        : await chat(messages, useTools, input.mode, {
            timeoutMs: budget(input.deadline, input.mode, MODE_TIMEOUT_MS[fallback]),
          });
    } catch (err) {
      if (!input.engine.claude && err instanceof Error && KIMI_REFUSAL.test(err.message)) {
        if (!isClaudeConfigured()) throw err;
        input.engine.claude = true;
        await input.onProgress?.("🛡️ Kimi refuse ce sujet : la rédaction passe à Claude…");
        msg = await claudeChatTurn({
          messages,
          tools: TOOLS,
          allowTools: useTools,
          timeoutMs: claudeBudget(input.deadline),
        });
      } else {
        if (input.engine.claude || !isTimeout(err)) throw err;
        await input.onProgress?.("⏳ Kimi est lent, nouvel essai en mode rapide…");
        msg = await chat(messages, useTools, fallback, {
          timeoutMs: budget(input.deadline, fallback, 0),
        });
      }
    }
    messages.push(msg);

    if (msg.tool_calls?.length) {
      const queries = msg.tool_calls.map((call) => parseQuery(call));
      await input.onSearch?.(queries.filter(Boolean));
      const results = await Promise.all(queries.map(search));
      msg.tool_calls.forEach((call, i) => {
        for (const r of results[i]!) {
          if (!r.url) continue;
          input.sources.set(r.url, {
            url: r.url,
            title: r.title || r.site_name || r.url,
            date: r.date,
          });
          if (r.text && !input.notes.has(r.url)) input.notes.set(r.url, r.text);
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(results[i]),
        });
      });
      continue;
    }

    const raw = String(msg.content || "").trim();
    const issues = input.check(raw);
    if (issues.length && !isLast) {
      messages.push({
        role: "user",
        content: `Ton texte ne respecte pas le format : ${issues.join(" ; ")}. Réécris-le en corrigeant cela, sans rien changer d'autre.`,
      });
      continue;
    }
    if (!raw) break;
    return raw;
  }
  throw new Error(
    input.engine.claude
      ? "Claude n’a pas abouti à un texte final"
      : "Kimi n’a pas abouti à un texte final",
  );
}

function dateNote(): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  return (
    `\n\nDATE : nous sommes le ${today}. Mets l'année en cours dans tes requêtes. ` +
    "Vérifie la date de chaque source : ne présente comme récent (« ce mardi », « hier »…) que ce qui date réellement des derniers jours, " +
    "et ne confonds pas un événement ancien avec l’actualité du moment."
  );
}

function parseQuery(call: ToolCall): string {
  try {
    return String(JSON.parse(call.function.arguments || "{}").query || "");
  } catch {
    return "";
  }
}

/** Temps accordé à un appel : plafonné par mode, en gardant de quoi tenter le mode suivant. */
function budget(deadline: number, mode: Mode, reserve: number): number {
  const left = deadline - Date.now() - reserve;
  if (left < 30_000) {
    throw new Error("Kimi trop lent aujourd’hui : rédaction abandonnée. Renvoie le sujet un peu plus tard.");
  }
  return Math.min(MODE_TIMEOUT_MS[mode], left);
}

/** Temps accordé à un tour Claude, dans le budget global de la rédaction. */
function claudeBudget(deadline: number): number {
  const left = deadline - Date.now();
  if (left < 30_000) {
    throw new Error("Plus assez de temps pour rédiger avec Claude. Renvoie le sujet.");
  }
  return Math.min(CLAUDE_TIMEOUT_MS, left);
}

function isTimeout(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
  return name === "TimeoutError" || name === "AbortError";
}

async function chat(
  messages: ChatMessage[],
  allowTools: boolean,
  mode: Mode,
  opts: { timeoutMs: number },
): Promise<ChatMessage> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      ...(allowTools && { tools: TOOLS }),
      ...(mode === "deep" && { model: MODEL }),
      ...(mode === "low" && { model: MODEL, reasoning_effort: "low", max_tokens: 8000 }),
      ...(mode === "fast" && {
        model: "kimi-k2.6",
        thinking: { type: "disabled" },
        max_tokens: 8000,
      }),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: ChatMessage }>;
    usage?: Parameters<typeof recordTokenUsage>[0];
    error?: { message?: string; type?: string };
  };
  if (!res.ok) {
    const message = data.error?.message || `HTTP ${res.status}`;
    if (data.error?.type === "content_filter" || /high risk/i.test(message)) {
      throw new Error(
        "Kimi a bloqué ce sujet (filtre de contenu). Reformule les consignes.",
      );
    }
    throw new Error(`Kimi ${res.status} : ${message}`);
  }
  if (data.usage) recordTokenUsage(data.usage);
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error("Réponse Kimi vide");
  return msg;
}

async function search(query: string): Promise<SearchHit[]> {
  if (!query) return [];
  try {
    const res = await fetch(`${BASE}/tools/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text_query: query,
        limit: 5,
        include_content: true,
        timeout_seconds: 15,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      search_results?: SearchHit[];
    };
    if (!res.ok) return [{ error: `Recherche indisponible (${res.status})` }];
    return (data.search_results || []).map((x) => ({
      title: x.title,
      url: x.url,
      site_name: x.site_name,
      date: x.date,
      snippet: x.snippet,
      text: pageText(x.text || ""),
    }));
  } catch (err) {
    console.error("brief search failed", query, err);
    return [{ error: "Recherche indisponible" }];
  }
}

/** Garde le corps de la page : les menus et bandeaux (lignes courtes) sautent. */
function pageText(raw: string): string {
  return scrubBoilerplate(raw)
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*#>]+/, "").trim())
    .filter((line) => line.split(/\s+/).length >= 8)
    .join("\n")
    .slice(0, 2000);
}

async function readProvidedLinks(
  brief: string,
  onProgress?: Hooks["onProgress"],
): Promise<Array<{ url: string; title: string; text: string }>> {
  const urls = [
    ...new Set(
      (brief.match(/https?:\/\/[^\s<>"')\]]+/gi) || []).map((u) =>
        u.replace(/[.,;:!?)]+$/, ""),
      ),
    ),
  ].slice(0, 3);
  if (!urls.length) return [];
  await onProgress?.(`📄 Lecture de ${urls.length > 1 ? "tes liens" : "ton lien"}…`);
  const read = await Promise.all(
    urls.map(async (url) => {
      try {
        const text = (await fetchSourceText(url)).slice(0, 6000);
        return text.length >= 80
          ? { url, title: outletFromUrl(url) || url, text }
          : null;
      } catch (err) {
        console.error("brief link unreadable", url, err);
        return null;
      }
    }),
  );
  return read.filter((r): r is NonNullable<typeof r> => Boolean(r));
}

function digest(
  sources: Map<string, BriefSource>,
  notes: Map<string, string>,
  noteChars = 1500,
  maxChars = 24_000,
): string {
  return [...sources.values()]
    .slice(0, 15)
    .map((s, i) =>
      [
        `${i + 1}. ${s.title}${s.date ? ` (${s.date})` : ""}\n   ${s.url}`,
        notes.get(s.url) ? `   ${notes.get(s.url)!.slice(0, noteChars)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n")
    .slice(0, maxChars);
}

async function imageDataUrl(image: { buffer: Buffer; mime: string }) {
  // Kimi n'a pas besoin de la pleine résolution : une copie de 1600 px suffit.
  const small = await sharp(image.buffer)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${small.toString("base64")}`;
}

// --- Flash --------------------------------------------------------------------

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const HASHTAG = /#[\p{L}\p{N}_]+/gu;
const DASH = /[–—]|(?:^|\s)-+(?=\s|$)/mu;
const URLISH = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:fr|com|org|net|tv|info)\b/i;

/** Sépare le corps du flash de la ligne « SOURCES : … » finale. */
function splitFlash(raw: string): { body: string; outlets: string[] } {
  let text = raw.trim().replace(/^["«»]+|["«»]+$/g, "").trim();
  let outlets: string[] = [];
  const line = text.match(/\n\s*\(?\s*SOURCES?\s*:\s*([^\n]+?)\)?\s*$/i);
  if (line) {
    outlets = line[1]!
      .split(/,|\bet\b/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter(Boolean)
      .slice(0, 2);
    text = text.slice(0, line.index).trim();
  }
  const head = text.match(
    /^[^\p{L}\p{N}]*(?:FLASH INFO|𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢)\s*[—–:-]?\s*/iu,
  );
  if (head) text = text.slice(head[0].length);
  return { body: text.trim(), outlets };
}

function flashIssues(body: string): string[] {
  const issues = wrongWeekdays(body);
  const words = countWords(body);
  if (words < FLASH_MIN_WORDS || words > FLASH_MAX_WORDS) {
    issues.push(
      `il fait ${words} mots au lieu de ${FLASH_MIN_WORDS} à ${FLASH_MAX_WORDS}`,
    );
  }
  if (body.match(EMOJI)) issues.push("il contient des emojis (interdits)");
  if (body.match(HASHTAG)) issues.push("il contient des hashtags (interdits)");
  if (DASH.test(body)) {
    issues.push(
      "il contient des tirets de ponctuation « - », « – » ou « — » (interdits, utilise virgule, deux-points ou point)",
    );
  }
  if (URLISH.test(body)) issues.push("il contient une URL ou un nom de domaine (interdit)");
  return issues;
}

function finishFlash(raw: string, providedUrl?: string): string {
  const { body, outlets } = splitFlash(raw);
  const clean = fixFrenchPunctuation(sanitize(fixOcrNumero(body)));
  const names = outlets.length
    ? outlets
    : [providedUrl && outletFromUrl(providedUrl)].filter(
        (x): x is string => Boolean(x),
      );
  const sourceLine = names.length
    ? `\n\n(Source${names.length > 1 ? "s" : ""} : ${names.join(", ")})`
    : "";
  return `${FLASH_PREFIX} ${clean}${sourceLine}`;
}

/** Filet de sécurité si Kimi insiste malgré les relances. */
function sanitize(text: string): string {
  return text
    .replace(HASHTAG, "")
    .replace(EMOJI, "")
    .replace(/^[ \t]*[-–—•][ \t]*/gm, "")
    .replace(/\s+[-–—]+\s+/g, ", ")
    .replace(/[–—]/g, ", ")
    .replace(/[ \t]+([,.])/g, "$1")
    .replace(/,\s*([,.:;!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => new RegExp("[\\p{L}\\p{N}]", "u").test(w)).length;
}

// --- Article ------------------------------------------------------------------

function parseArticle(raw: string): {
  title: string;
  excerpt: string;
  content: string;
} {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("la réponse n'est pas un JSON");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  return {
    title: String(obj.title || "").trim(),
    excerpt: String(obj.excerpt || "").trim(),
    content: String(obj.content || "").trim(),
  };
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre",
];
const WEEKDAY_DATE = new RegExp(
  `\\b(${WEEKDAYS.join("|")})\\s+(\\d{1,2})(?:er)?\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?`,
  "gi",
);

/** Jours de la semaine faux (« mercredi 29 octobre 2026 ») : l'année manquante vaut l'année en cours. */
export function wrongWeekdays(text: string, now = new Date()): string[] {
  const issues: string[] = [];
  for (const m of text.matchAll(WEEKDAY_DATE)) {
    const year = Number(m[4]) || now.getFullYear();
    const month = MONTHS.indexOf(m[3]!.toLowerCase());
    const real = WEEKDAYS[new Date(Date.UTC(year, month, Number(m[2]))).getUTCDay()]!;
    if (real !== m[1]!.toLowerCase()) {
      issues.push(`« ${m[0]} » est faux, cette date tombe un ${real}`);
    }
  }
  return [...new Set(issues)];
}

export function articleIssues(a: { title: string; excerpt: string; content: string }) {
  const issues = wrongWeekdays(`${a.title}\n${a.excerpt}\n${a.content}`);
  if (a.title.length < 15) issues.push("le titre manque ou est trop court");
  if (a.title.length > TITLE_MAX_CHARS) {
    issues.push(`le titre fait ${a.title.length} caractères, ${TITLE_MAX_CHARS} au plus`);
  }
  if (a.title === a.title.toUpperCase()) issues.push("le titre est tout en majuscules");
  if (a.excerpt.length < 20) issues.push("le chapô (excerpt) manque");
  if (a.excerpt.length > EXCERPT_MAX_CHARS) {
    issues.push(`le chapô fait ${a.excerpt.length} caractères, ${EXCERPT_MAX_CHARS} au plus`);
  }
  const words = countWords(a.content);
  if (words < ARTICLE_MIN_WORDS) {
    issues.push(`le corps fait ${words} mots, il en faut au moins ${ARTICLE_MIN_WORDS}`);
  }
  const longest = Math.max(
    0,
    ...a.content
      .split(/\n{2,}/)
      .filter((p) => !p.startsWith("#"))
      .map(countWords),
  );
  if (longest > PARAGRAPH_MAX_WORDS) {
    issues.push(
      `un paragraphe fait ${longest} mots : coupe-le, la limite est de 60 mots`,
    );
  }
  const headings = a.content.match(/^##\s/gm)?.length ?? 0;
  if (headings < ARTICLE_MIN_HEADINGS) {
    issues.push(
      `le corps a ${headings} intertitre(s) « ## », il en faut au moins ${ARTICLE_MIN_HEADINGS}`,
    );
  }
  return issues;
}

function finishArticle(
  a: { title: string; excerpt: string; content: string },
  policy: LinkPolicy,
) {
  const dashes = (s: string) =>
    fixOcrNumero(s).replace(/\s+[–—]\s+/g, ", ").replace(/[–—]/g, ", ").replace(EMOJI, "");
  const body = italicizeCitations(
    outsideLinkTargets(stripSourcesSection(enforceLinks(a.content, policy)), (text) =>
      text
        .split("\n")
        .map((line) => (line.trim() ? fixFrenchPunctuation(dashes(line)) : ""))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n"),
    ),
  );
  return {
    title: fixFrenchPunctuation(dashes(a.title)).replace(/\.$/, "").slice(0, 220),
    excerpt: fixFrenchPunctuation(dashes(a.excerpt)),
    content: body,
  };
}
