/**
 * Recherche web réelle à partir d'un titre / caption.
 *
 * Priorité :
 * 1. Moonshot `$web_search` (kimi-k2.6) — fiable, utilise MOONSHOT_API_KEY
 * 2. SERPER_API_KEY / BRAVE_API_KEY si présents
 * 3. Fallbacks gratuits : Bing HTML, Google News RSS, DuckDuckGo
 */

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  publicationDate?: string;
  discoveredVia: string;
};

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .trim();
}

function stripPublisherSuffix(title: string): string {
  return title.replace(/\s+[-–—|]\s+[^-–—|]+$/, "").trim();
}

/* ────────────────────── Extraction d'entités du sujet ────────────────────── */

function deaccent(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function norm(text: string): string {
  return deaccent(text.toLowerCase()).replace(/\s+/g, " ").trim();
}

function wordSet(source: string): Set<string> {
  return new Set(source.split(/\s+/).filter(Boolean).map((w) => norm(w)));
}

const FR_STOPWORDS = wordSet(`a à afin ai aient ainsi alors après as au aucun aucune aujourd auquel aussi autre autres
   aux avait avaient avant avec avoir ayant bien car ça ce ceci cela celle celles celui
   cependant certain certaine certains ces cet cette ceux chacun chaque chez comme comment
   contre dans de des du dès déjà depuis derrière dessous dessus deux dit dont donc elle
   elles en encore entre est et étaient était été être eu eux fait faire fois font hors ici
   il ils je jusqu la là le les leur leurs lui ma mais malgré me même mes moi moins mon ne
   ni non nos notre nous on ont ou où oui par parce pas pendant peu peut plus plusieurs
   plutôt pour pourquoi près puis qu que quel quelle quelles quels qui quoi sa sans se sera
   seront ses si sinon soit son sont sous suite sur ta tandis te tel telle tes toi ton tous
   tout toute toutes très trop tu un une va vers veut via voici voilà vont vos votre vous y`);

/**
 * Vocabulaire journalistique / militant générique : jamais une entité nommée.
 * Sert surtout aux captions tout en majuscules où la casse ne dit plus rien.
 */
const GENERIC_WORDS = wordSet(
  `actualite affaire agression aide aides amende annonce argent argent arrestation article
   assemblee association associations attaque augmentation auteur autorite autorites avocat
   banque budget bureau cadre cadres caisse centre chaine chef chiffre chiffres chomage
   citoyen citoyens clandestin clandestins collectif commission communaute commune compte
   comptes condamnation conseil contribuable contribuables cour crise deficit delinquance
   demission depense depenses depute deputes detournement direction directeur directrice
   dirigeant dirigeants dissolution dossier droite drame ecole economie elu elus embauche
   embauches emploi enquete entreprise etat euro euros expulsion famille familles faillite
   femme femmes fonds france francais francaise gauche gestion gouvernement grave greve
   groupe habitant habitants haut haute immigration impot impots insecurite institution
   institutions journal journaliste juge jugement justice liquidation liquide liquidee local
   logement loi maire mairie majorite mandat manifestation marche media medias membre membres
   migrant migrants milliard milliards million millions ministere ministre mise mois montant
   municipal national ong operation opposition organisation parlement parti partie patron
   pays personne personnes plainte police politique poste prefecture president prefet
   presse prison probleme procedure proces procureur professionnel projet public quartier
   rapport redressement region regional reseau responsable responsables ressources retraite
   reunion revenu salaire salaires salarie salaries scandale secteur senateur service
   services situation social sociale socialiste societe somme sondage subvention subventions
   syndicat systeme tribunal trou usager usagers ville violence violences
   belge belges britannique allemand allemande espagnol italien americain americaine
   chaine chaines emission reportage image images video videos scene scenes camera
   triste tristes grand grande grands grandes petit petite nouveau nouvelle nouveaux
   ancien ancienne premier premiere dernier derniere jeune jeunes vieux vieille
   homme hommes enfant enfants mineur mineurs majeur adulte adultes eleve eleves
   demander demande demandes rejouer pleurer jouer joue faire fait dire dit voir vu
   prendre prise pris train alors ensuite encore toujours jamais bien mal
   annee annees mois semaine semaines jour jours heure heures matin soir nuit
   lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars avril
   mai juin juillet aout septembre octobre novembre decembre
   nombre nombreux nombreuse total totale general generale nationale national
   selon apres avant depuis pendant contre entre parmi malgre sans avec pour dans
   nouvel autre autres meme memes tel telle certains certaines chaque tout tous
   cause consequence raison motif effet suite fin debut milieu cadre partie ensemble
   maniere facon moyen moyens type sorte genre exemple cas point sujet question
   probleme solution resultat resultats mesure mesures action actions reforme reformes
   decision decisions choix vote elections election campagne mandat pouvoir pouvoirs
   argent somme montant montants cout couts prix tarif tarifs charge charges
   travail emplois poste postes recrutement recrutements equipe equipes personnel`);

/** Entités trop communes pour servir de pivot de recherche. */
const WEAK_ENTITIES = new Set([
  "france",
  "francais",
  "francaise",
  "europe",
  "etat",
  "republique",
  "elysee",
  "gouvernement",
  "assemblee nationale",
  "senat",
  "union europeenne",
]);

/** Toponymes courants : utiles en complément, rarement le pivot. */
const PLACE_WORDS = wordSet(
  `paris marseille lyon toulouse nice nantes montpellier strasbourg bordeaux lille rennes
   reims toulon saint-etienne havre grenoble dijon angers nimes villeurbanne clermont-ferrand
   aix-en-provence brest tours amiens limoges annecy perpignan besancon metz orleans rouen
   argenteuil mulhouse caen nancy roubaix tourcoing avignon poitiers dunkerque versailles
   creteil pau calais colmar bourges quimper valence antibes cannes ajaccio bastia corse
   bretagne normandie occitanie provence aquitaine alsace lorraine picardie auvergne bourgogne
   savoie martinique guadeloupe guyane reunion mayotte`);

/** Verbes / notions d'action → mot-clé de recherche normalisé. */
const ACTION_TERMS: Array<[RegExp, string]> = [
  [/liquidation|liquid[ée]e?s?\b|liquider/i, "liquidation judiciaire"],
  [/redressement judiciaire/i, "redressement judiciaire"],
  [/faillite|banqueroute|cessation de paiement/i, "faillite"],
  [/d[ée]ficit|trou financier|trou de|passif|dette/i, "déficit"],
  [/d[ée]tournement|abus de biens|malversation/i, "détournement de fonds"],
  [/fraude|escroquerie/i, "fraude"],
  [/condamn[ée]|condamnation/i, "condamnation"],
  [/mis(?:e|es)? en examen/i, "mise en examen"],
  [/perquisition/i, "perquisition"],
  [/garde [àa] vue/i, "garde à vue"],
  [/enqu[êe]te|parquet|procureur|information judiciaire/i, "enquête"],
  [/proc[èe]s|tribunal|audience/i, "procès"],
  [/dissolution|dissous|dissoute/i, "dissolution"],
  [/subvention/i, "subventions publiques"],
  [/masse salariale|r[ée]mun[ée]ration|haut salaire|salaires? [ée]lev/i, "salaires dirigeants"],
  [/licenciement|plan social|reclassement/i, "licenciements"],
  [/d[ée]mission/i, "démission"],
  [/plainte|porter plainte/i, "plainte"],
  [/expulsion|OQTF|reconduite/i, "expulsion OQTF"],
  [/agression|violence|meurtre|homicide/i, "agression"],
  [/gr[èe]ve/i, "grève"],
  [/mise en sc[èe]ne|staging|rejouer|sur commande/i, "mise en scène"],
];

export type SubjectEntities = {
  /** Entités nommées, la plus distinctive d'abord. */
  names: string[];
  /** Variantes de montants exploitables en requête ("1,4 million"). */
  amounts: string[];
  /** Termes d'action normalisés ("liquidation judiciaire"). */
  actions: string[];
  /** Tokens significatifs, sans accents, en minuscules. */
  tokens: string[];
};

/** Retire l'article élidé collé ("L'association" → "association"). */
function stripElision(word: string): string {
  const m = word.match(/^[A-Za-zÀ-ÿ]{1,2}['’](.+)$/);
  return m ? m[1]! : word;
}

/** Plus le score est haut, plus l'entité est un bon pivot de recherche. */
function nameScore(name: string): number {
  const key = norm(name);
  const parts = name.split(" ");
  let s = Math.min(name.length, 22) * 0.5;

  if (WEAK_ENTITIES.has(key)) s -= 40;
  if (parts.every((p) => PLACE_WORDS.has(norm(p)))) s -= 12;
  else if (parts.some((p) => PLACE_WORDS.has(norm(p)))) s -= 5;

  if (parts.length === 2) s += 14;
  else if (parts.length >= 3) s += 4;

  // Sigle : presque toujours l'organisation au cœur du sujet.
  if (parts.length === 1 && /^[A-ZÀ-Þ0-9]{2,6}$/.test(name)) s += 20;

  return s;
}

export function extractSubjectEntities(subject: string): SubjectEntities {
  const raw = subject.replace(/\s+/g, " ").trim();
  const letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upperRatio = letters
    ? letters.replace(/[^A-ZÀ-Þ]/g, "").length / letters.length
    : 0;
  const capsMode = upperRatio > 0.6;

  const words = raw
    .split(/[^A-Za-zÀ-ÿ0-9'’-]+/)
    .map(stripElision)
    .filter((w) => w.length >= 2);

  const isStop = (w: string) => FR_STOPWORDS.has(norm(w));
  const isGeneric = (w: string) => GENERIC_WORDS.has(norm(w));

  const candidates: string[] = [];

  if (!capsMode) {
    // Suites de mots capitalisés = organisations, personnes, lieux.
    let run: string[] = [];
    const flush = () => {
      if (run.length === 0) return;
      // Bigrammes adjacents plutôt qu'un bloc long : « Éric Piolle », pas
      // « Grenoble Éric Piolle ». Un nom commun capitalisé ne compte que
      // s'il est accolé à un autre ("France Travail", "Cour des comptes").
      for (let i = 0; i + 1 < run.length; i += 1) {
        candidates.push(`${run[i]} ${run[i + 1]}`);
      }
      candidates.push(...run.filter((w) => !isGeneric(w)));
      run = [];
    };
    for (const w of words) {
      const capitalized =
        /^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]+$/.test(w) || /^[A-ZÀ-Þ]{2,}$/.test(w);
      if (capitalized && !isStop(w) && w.length >= 3) run.push(w);
      else flush();
    }
    flush();
  }

  if (candidates.length === 0) {
    // Caption tout en majuscules : la casse ne distingue plus rien.
    // On écarte le lexique courant et les infinitifs / participes.
    for (const w of words) {
      if (/^\d+$/.test(w)) continue;
      if (isStop(w) || isGeneric(w)) continue;
      const acronym = w.length >= 2 && w.length <= 6;
      if (!acronym && w.length < 4) continue;
      if (w.length >= 5 && /(?:er|ir|ez|ons|ait|aient|ant|ement)$/i.test(w)) continue;
      candidates.push(acronym ? w.toUpperCase() : w.charAt(0) + w.slice(1).toLowerCase());
    }
  }

  const seenNames = new Set<string>();
  const names = candidates
    .map((c) => c.replace(/[-–—]$/, "").trim())
    .filter((c) => {
      const key = norm(c);
      if (key.length < 3 || seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .sort((a, b) => nameScore(b) - nameScore(a))
    .slice(0, 5);

  const amounts: string[] = [];
  const amountRe =
    /(\d{1,4}(?:[.,\s]\d{1,3})?)\s*(millions?|milliards?|euros?|€|%)/gi;
  for (const m of raw.matchAll(amountRe)) {
    const num = m[1]!.replace(/\s/g, "");
    const unit = m[2]!.toLowerCase().replace(/^€$/, "euros");
    const base = unit.startsWith("milli")
      ? `${num} ${unit.replace(/s$/, "")}`
      : `${num} ${unit}`;
    amounts.push(base.replace(/\./g, ","));
    if (base.includes(",")) amounts.push(base.replace(/,/g, "."));
  }

  const actions: string[] = [];
  for (const [re, label] of ACTION_TERMS) {
    if (re.test(raw) && !actions.includes(label)) actions.push(label);
  }

  const tokens = [
    ...new Set(
      words
        .map((w) => norm(w))
        .filter((w) => w.length >= 4 && !FR_STOPWORDS.has(w)),
    ),
  ];

  return {
    names,
    amounts: [...new Set(amounts)].slice(0, 4),
    actions: actions.slice(0, 5),
    tokens,
  };
}

/** Deux libellés qui se recouvrent : inutile de les combiner en requête. */
function overlaps(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(" "));
  return nb.split(" ").some((w) => w.length >= 3 && wordsA.has(w));
}

/** Médias français à privilégier quand on cherche l'article de référence. */
const PRESS_HINTS = [
  "Mediacités",
  "La Dépêche",
  "Le Monde",
  "Mediapart",
  "France 3",
  "actu.fr",
];

/**
 * Requêtes courtes et ciblées, dérivées des entités du sujet.
 * La caption complète (rant Telegram) n'est jamais la requête principale
 * au-delà de ~80 caractères : elle noie les moteurs.
 */
export function buildWebSearchQueries(
  subject: string,
  extra: string[] = [],
): string[] {
  const raw = subject.replace(/\s+/g, " ").trim();
  const e = extractSubjectEntities(raw);
  const queries: string[] = [];

  const primary = e.names[0];
  const others = primary
    ? e.names.slice(1).filter((n) => !overlaps(primary, n)).slice(0, 2)
    : [];
  const actions = primary
    ? e.actions.filter((a) => !overlaps(primary, a))
    : e.actions;

  if (raw.length <= 80 && raw.length >= 12) queries.push(raw);

  if (primary) {
    if (actions[0]) queries.push(`${primary} ${actions[0]}`);
    if (e.amounts[0]) queries.push(`${primary} ${e.amounts[0]}`);
    if (actions[1]) queries.push(`${primary} ${actions[1]}`);
    for (const other of others) queries.push(`${primary} ${other}`);
    if (actions.length + others.length < 2) {
      const rest = e.tokens
        .filter((t) => t.length >= 5 && !norm(primary).includes(t))
        .slice(0, 3)
        .join(" ");
      if (rest) queries.push(`${primary} ${rest}`);
    }
    queries.push(primary);
  }

  if (!primary) {
    const fallback = e.tokens.slice(0, 6).join(" ");
    if (fallback.length >= 10) queries.push(fallback);
  }

  for (const q of extra) {
    if (q.trim().length >= 6) queries.push(q.trim().slice(0, 140));
  }

  // Caption complète en dernier recours seulement.
  if (raw.length > 80) queries.push(raw.slice(0, 140));

  return [
    ...new Set(
      queries.map((q) => q.replace(/\s+/g, " ").trim()).filter((q) => q.length >= 5),
    ),
  ].slice(0, 8);
}

/**
 * Requêtes de rattrapage : entité + presse, entité + action secondaire.
 * Utilisées quand la première passe ne ramène rien de pertinent.
 */
export function buildFocusedEntityQueries(subject: string): string[] {
  const e = extractSubjectEntities(subject);
  const primary = e.names[0];
  if (!primary) return [];

  const actions = e.actions.filter((a) => !overlaps(primary, a));

  const queries: string[] = [];
  for (const hint of PRESS_HINTS.slice(0, 3)) queries.push(`${primary} ${hint}`);
  for (const action of actions.slice(0, 3)) queries.push(`${primary} ${action}`);
  for (const amount of e.amounts.slice(0, 1)) queries.push(`${primary} ${amount}`);
  queries.push(`${primary} enquête`);
  queries.push(`"${primary}" actualité`);

  return [...new Set(queries)].slice(0, 8);
}

function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    /* continue */
  }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function parseHitsPayload(
  payload: unknown,
  via: string,
): WebSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { hits?: unknown[] };
  const rows = Array.isArray(root.hits) ? root.hits : [];
  const out: WebSearchHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const title = String(r.title || "").trim();
    const url = String(r.url || "").trim();
    const snippet = String(r.snippet || r.description || "").trim();
    const publisher = String(r.publisher || r.source || "").trim();
    if (title.length < 8 || !/^https?:\/\//i.test(url)) continue;
    if (/example\.com|localhost/i.test(url)) continue;
    out.push({
      title: title.slice(0, 240),
      url,
      snippet: snippet.slice(0, 1200),
      publisher: publisher || undefined,
      discoveredVia: via,
    });
  }
  return out;
}

type MoonshotMsg = Record<string, unknown>;

/**
 * Recherche via Moonshot `$web_search` (builtin).
 * kimi-k3 a un bug tokenization au round 2 → on force kimi-k2.6.
 */
async function searchMoonshotWeb(
  subject: string,
  opts?: { fast?: boolean; queries?: string[] },
): Promise<WebSearchHit[]> {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();
  if (!apiKey) return [];

  const model =
    process.env.KIMI_SEARCH_MODEL?.trim() ||
    process.env.KIMI_WEB_SEARCH_MODEL?.trim() ||
    "kimi-k2.6";

  const queries = (
    opts?.queries?.length ? opts.queries : buildWebSearchQueries(subject)
  ).slice(0, opts?.fast ? 3 : 4);
  const entities = extractSubjectEntities(subject);
  const roundTimeout = opts?.fast ? 45_000 : 75_000;
  const maxRounds = opts?.fast ? 3 : 4;
  const messages: MoonshotMsg[] = [
    {
      role: "system",
      content: [
        "Tu es documentaliste pour une rédaction française. Tu cherches L'ARTICLE DE PRESSE qui raconte l'affaire précise décrite par l'utilisateur.",
        "Utilise TOUJOURS l'outil $web_search, avec des requêtes COURTES centrées sur les noms propres (organisation, personne, ville) et le montant, pas la phrase complète.",
        "Cible en priorité la presse francophone : mediacites.fr, ladepeche.fr, lemonde.fr, mediapart.fr, lefigaro.fr, liberation.fr, francetvinfo.fr, francebleu.fr, actu.fr, ouest-france.fr, sudouest.fr, lavoixdunord.fr, letelegramme.fr, laprovence.com, lesechos.fr, latribune.fr, ainsi que la presse quotidienne régionale et les sites officiels (.gouv.fr, tribunaux, journal officiel, bodacc).",
        "Chaque hit doit être une PAGE D'ARTICLE précise (URL profonde), jamais une page d'accueil, un annuaire, une rubrique ou une page de recherche.",
        "REJETTE tout résultat hors sujet : si la page ne parle pas de l'organisation / personne / affaire citée, ne la renvoie pas. Mieux vaut 2 hits justes que 10 hits de bruit politique générique.",
        "snippet : recopie 2 à 4 phrases utiles de la page (chiffres, noms, dates), pas une paraphrase vague.",
        "N'invente JAMAIS une URL, un titre ou un média.",
        'Réponds UNIQUEMENT avec un JSON valide : {"hits":[{"title":"...","url":"https://...","snippet":"...","publisher":"...","publicationDate":"AAAA-MM-JJ"}]} — 10 hits maximum, pas de markdown, pas de prose.',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Sujet / caption à documenter :\n${subject.slice(0, 400)}`,
        entities.names.length
          ? `Entités à retrouver impérativement dans les résultats : ${entities.names.join(", ")}`
          : "",
        entities.amounts.length
          ? `Montants cités : ${entities.amounts.join(" / ")}`
          : "",
        entities.actions.length
          ? `Nature de l'affaire : ${entities.actions.join(", ")}`
          : "",
        `Requêtes à lancer via $web_search (2 à 4, telles quelles) :\n${queries
          .map((q, i) => `${i + 1}. ${q}`)
          .join("\n")}`,
        "Renvoie ensuite uniquement le JSON hits, en écartant les pages qui ne mentionnent pas les entités ci-dessus.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  let finishReason: string | undefined;
  let rounds = 0;
  let lastContent = "";

  while (rounds < maxRounds) {
    rounds++;
    const body: Record<string, unknown> = {
      model,
      max_tokens: opts?.fast ? 1800 : 2500,
      messages,
      tools: [
        {
          type: "builtin_function",
          function: { name: "$web_search" },
        },
      ],
    };
    if (model.includes("k2.6") || model.includes("k2.5")) {
      body.thinking = { type: "disabled" };
    } else if (model.includes("k3")) {
      body.reasoning_effort = "low";
    }

    const res = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(roundTimeout),
    });

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type?: string;
            function: { name: string; arguments: string };
          }>;
          reasoning_content?: string;
        };
      }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message || `Moonshot search HTTP ${res.status}`,
      );
    }

    const choice = data.choices?.[0];
    if (!choice?.message) break;
    finishReason = choice.finish_reason;
    lastContent = choice.message.content?.trim() || "";

    if (finishReason === "tool_calls" && choice.message.tool_calls?.length) {
      messages.push(choice.message as MoonshotMsg);
      for (const tc of choice.message.tool_calls) {
        let args: unknown = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(args),
        });
      }
      continue;
    }

    // stop / length : tenter parse ; sinon 1 relance JSON only
    const parsed = parseHitsPayload(
      extractJsonObject(lastContent),
      `moonshot_web:${model}`,
    );
    if (parsed.length > 0) return parsed;

    if (rounds < maxRounds && finishReason !== "tool_calls") {
      messages.push({
        role: "assistant",
        content: lastContent || "",
      });
      messages.push({
        role: "user",
        content:
          'Réponds maintenant UNIQUEMENT avec le JSON {"hits":[...]} à partir des résultats de recherche. Aucune prose.',
      });
      continue;
    }
    break;
  }

  return parseHitsPayload(
    extractJsonObject(lastContent),
    `moonshot_web:${model}`,
  );
}

async function fetchRssItems(
  feedUrl: string,
  via: string,
): Promise<WebSearchHit[]> {
  const res = await fetch(feedUrl, {
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8);
  const out: WebSearchHit[] = [];

  for (const match of items) {
    const block = match[1]!;
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const linkRaw =
      block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
    if (!titleRaw || !linkRaw) continue;
    const title = stripPublisherSuffix(decodeXml(titleRaw));
    const link = decodeXml(linkRaw).trim();
    if (title.length < 8 || !/^https?:\/\//i.test(link)) continue;
    const desc = decodeXml(
      block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "",
    );
    const source = decodeXml(
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "",
    );
    const published = decodeXml(
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "",
    );
    out.push({
      title,
      url: link,
      snippet: desc.slice(0, 1200),
      publisher: source || undefined,
      publicationDate: published || undefined,
      discoveredVia: via,
    });
  }
  return out;
}

async function searchGoogleNews(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "fr");
  url.searchParams.set("gl", "FR");
  url.searchParams.set("ceid", "FR:fr");
  return fetchRssItems(url.toString(), `google_news:${query.slice(0, 50)}`);
}

async function searchBingNews(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://www.bing.com/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "RSS");
  url.searchParams.set("mkt", "fr-FR");
  return fetchRssItems(url.toString(), `bing_news:${query.slice(0, 50)}`);
}

function decodeBingRedirect(href: string): string {
  const raw = href.replace(/&amp;/g, "&").trim();
  try {
    const u = new URL(raw, "https://www.bing.com");
    const encoded = u.searchParams.get("u");
    if (encoded) {
      const b64 = encoded
        .replace(/^a1/, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  } catch {
    /* keep */
  }
  if (/^https?:\/\//i.test(raw) && !/bing\.com\/ck\//i.test(raw)) return raw;
  return "";
}

/** Bing HTML organique — plus stable que le RSS Bing News. */
async function searchBingHtml(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("setlang", "fr-FR");
  url.searchParams.set("cc", "FR");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const blocks = html.split(/class="b_algo"/i).slice(1, 10);
  const out: WebSearchHit[] = [];

  for (const block of blocks) {
    const a = block.match(
      /<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!a) continue;
    const href = decodeBingRedirect(a[1]!);
    const title = decodeHtml(a[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const snippetRaw =
      block.match(/class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ||
      "";
    const snippet = decodeHtml(snippetRaw)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!href || title.length < 8) continue;
    out.push({
      title,
      url: href,
      snippet: snippet.slice(0, 1200),
      discoveredVia: `bing_html:${query.slice(0, 50)}`,
    });
  }
  return out;
}

async function searchDuckDuckGo(query: string): Promise<WebSearchHit[]> {
  const url = new URL("https://html.duckduckgo.com/html/");
  url.searchParams.set("q", query);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "User-Agent": CHROME_UA,
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ q: query }).toString(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const out: WebSearchHit[] = [];

  const blocks = html.split(/class="result__body"|class='result__body'/i);
  for (const block of blocks.slice(1, 10)) {
    const hrefMatch =
      block.match(
        /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
      ) ||
      block.match(/uddg=([^&"]+).*?class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = block.match(
      /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i,
    );

    let href = "";
    let title = "";
    if (hrefMatch) {
      href = decodeHtml(hrefMatch[1] || "");
      title = decodeHtml(hrefMatch[2] || "")
        .replace(/<[^>]+>/g, "")
        .trim();
      const uddg = href.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]!);
        } catch {
          /* keep */
        }
      }
      if (href.startsWith("//")) href = `https:${href}`;
    }
    const snippet = decodeHtml(snippetMatch?.[1] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!/^https?:\/\//i.test(href) || title.length < 8) continue;
    if (/duckduckgo\.com\//i.test(href) && !href.includes("uddg=")) continue;

    out.push({
      title,
      url: href,
      snippet: snippet.slice(0, 1200),
      discoveredVia: `duckduckgo:${query.slice(0, 50)}`,
    });
  }

  return out;
}

async function searchBrave(query: string): Promise<WebSearchHit[]> {
  const key = process.env.BRAVE_API_KEY?.trim();
  if (!key) return [];
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("search_lang", "fr");
  url.searchParams.set("country", "FR");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title?: string; url?: string; description?: string }>;
    };
  };
  return (data.web?.results || [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!,
      url: r.url!,
      snippet: (r.description || "").slice(0, 1200),
      discoveredVia: `brave:${query.slice(0, 50)}`,
    }));
}

async function searchSerper(query: string): Promise<WebSearchHit[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "fr", hl: "fr", num: 8 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    news?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      source?: string;
    }>;
  };
  const hits: WebSearchHit[] = [];
  for (const n of data.news || []) {
    if (!n.link || !n.title) continue;
    hits.push({
      title: n.title,
      url: n.link,
      snippet: (n.snippet || "").slice(0, 1200),
      publisher: n.source,
      discoveredVia: `serper_news:${query.slice(0, 50)}`,
    });
  }
  for (const o of data.organic || []) {
    if (!o.link || !o.title) continue;
    hits.push({
      title: o.title,
      url: o.link,
      snippet: (o.snippet || "").slice(0, 1200),
      discoveredVia: `serper:${query.slice(0, 50)}`,
    });
  }
  return hits;
}

function dedupeHits(hits: WebSearchHit[]): WebSearchHit[] {
  const seen = new Set<string>();
  const out: WebSearchHit[] = [];
  for (const h of hits) {
    const key = h.url.split("?")[0]!.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function isHomepageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" || /^\/(fr|en|nl|vrtnws\/(fr|en|nl))?$/i.test(path);
  } catch {
    return false;
  }
}

/** Presse d'enquête / quotidiens nationaux — meilleure matière première. */
const STRONG_PRESS_RE =
  /mediacites|mediapart|lemonde|lefigaro|liberation|lesechos|latribune|la-croix|lopinion|marianne|lexpress|lepoint|challenges|capital\.fr|alternatives-economiques|arretsurimages|disclose|streetpress/i;

/** Presse quotidienne régionale et généraliste — souvent LA source locale. */
const REGIONAL_PRESS_RE =
  /ladepeche|sudouest|ouest-france|letelegramme|lavoixdunord|lamontagne|lest-eclair|estrepublicain|republicain-lorrain|dna\.fr|nicematin|varmatin|laprovence|ledauphine|leprogres|lyoncapitale|actu\.fr|francebleu|france3-regions|francetvinfo|20minutes|leparisien|larep\.fr|courrier-picard|lunion\.fr|paris-normandie|lepopulaire|centrepresseaveyron|midilibre|lindependant|nouvelobs|bfmtv|rmc\.bfmtv|europe1|rtl\.fr|publicsenat|banquedesterritoires|localtis|batiactu|lagazettedescommunes/i;

const OFFICIAL_RE = /\.gouv\.fr|legifrance|bodacc|journal-officiel|infogreffe|societe\.com|insee\.fr|ccomptes\.fr|vie-publique/i;

/** Pages qui ne sont jamais des articles. */
const NON_ARTICLE_RE =
  /annuaire|repertoire|\/recherche|\/search|\/tag\/|\/tags\/|\/rubrique|\/categorie|\/category\/|\/auteur\/|\/author\/|\/demarche|\/mentions-legales|\/nous-contacter|linkedin\.com\/company|societe\.com\/annonce/i;

/** URL d'article profonde (date, identifiant, slug long). */
function looksLikeArticleUrl(url: string): boolean {
  return (
    /\/\d{4}\/\d{2}\/\d{2}\//.test(url) ||
    /\/\d{4}\/\d{2}\//.test(url) ||
    /-\d{5,}(\.php|\.html)?$/.test(url) ||
    /\/(article|actualite|actualites|enquete|info|news|societe|faits-divers)\//i.test(
      url,
    )
  );
}

/** Nombre d'entités du sujet réellement présentes dans le hit. */
export function countEntityMatches(
  hit: WebSearchHit,
  entities: SubjectEntities,
): number {
  const hay = norm(`${hit.title} ${hit.snippet} ${hit.publisher || ""}`);
  const urlHay = norm(decodeURIComponent(hit.url).replace(/[-_/]+/g, " "));
  let matches = 0;
  for (const name of entities.names) {
    const key = norm(name);
    if (key.length < 3) continue;
    if (hay.includes(key) || urlHay.includes(key)) matches += 1;
  }
  return matches;
}

/**
 * Un hit est retenu comme « sur le sujet » s'il mentionne au moins une entité
 * nommée ; à défaut d'entité identifiée, on retombe sur le recouvrement lexical.
 */
export function isOnTopicHit(
  hit: WebSearchHit,
  entities: SubjectEntities,
): boolean {
  if (entities.names.length > 0) return countEntityMatches(hit, entities) > 0;
  const hay = norm(`${hit.title} ${hit.snippet}`);
  const overlap = entities.tokens.filter(
    (t) => t.length >= 5 && hay.includes(t),
  ).length;
  return overlap >= 3;
}

/**
 * Hit vraiment exploitable : sur le sujet ET page d'article.
 * Une page d'accueil ou un annuaire qui cite l'entité ne documente rien.
 */
export function isStrongHit(
  hit: WebSearchHit,
  entities: SubjectEntities,
): boolean {
  if (!isOnTopicHit(hit, entities)) return false;
  if (isHomepageUrl(hit.url)) return false;
  if (NON_ARTICLE_RE.test(hit.url)) return false;
  if (/wikipedia\.org|youtube\.com|tvgids|linkedin\.com/i.test(hit.url))
    return false;
  return looksLikeArticleUrl(hit.url);
}

export function relevanceScore(
  hit: WebSearchHit,
  subject: string,
  precomputed?: SubjectEntities,
): number {
  const entities = precomputed || extractSubjectEntities(subject);
  const hay = norm(`${hit.title} ${hit.snippet} ${hit.publisher || ""}`);
  const urlHay = norm(decodeURIComponent(hit.url).replace(/[-_/]+/g, " "));

  // La longueur du snippet ne doit jamais primer sur la pertinence.
  let s = Math.min(hit.snippet.length, 400) / 5;

  let nameHits = 0;
  entities.names.forEach((name, i) => {
    const key = norm(name);
    if (key.length < 3) return;
    const weight = i === 0 ? 300 : 130;
    if (hay.includes(key)) {
      s += weight;
      nameHits += 1;
    }
    if (urlHay.includes(key)) {
      s += weight * 0.5;
      nameHits += 1;
    }
  });

  for (const action of entities.actions) {
    const head = norm(action.split(" ")[0]!);
    if (head.length >= 5 && (hay.includes(head) || urlHay.includes(head))) s += 70;
  }

  for (const amount of entities.amounts) {
    const digits = amount.replace(/[^0-9]/g, "");
    if (digits.length >= 2 && hay.replace(/[^0-9]/g, "").includes(digits)) s += 90;
  }

  const tokenMatches = entities.tokens.filter(
    (t) => t.length >= 5 && hay.includes(t),
  ).length;
  s += Math.min(tokenMatches, 8) * 22;

  // Hors sujet : aucune entité du sujet dans la page.
  if (entities.names.length > 0 && nameHits === 0) s -= 600;

  if (STRONG_PRESS_RE.test(hit.url)) s += 130;
  else if (REGIONAL_PRESS_RE.test(hit.url)) s += 110;
  else if (OFFICIAL_RE.test(hit.url)) s += 120;

  if (looksLikeArticleUrl(hit.url)) s += 70;
  if (/enquete|revelations|documents/i.test(hit.url)) s += 40;

  if (isHomepageUrl(hit.url)) s -= 250;
  if (NON_ARTICLE_RE.test(hit.url)) s -= 260;
  if (/news\.google|bing\.com\/news|bing\.com\/ck/i.test(hit.url)) s -= 150;
  if (/wikipedia\.org|facebook\.com|pinterest|youtube\.com\/channel/i.test(hit.url))
    s -= 80;

  // Sujets d'accusation médiatique : les réseaux portent souvent la preuve.
  if (entities.actions.includes("mise en scène")) {
    if (/mise en sc[eè]ne|staging|rejouer|sur commande|toneel/i.test(hay)) s += 220;
    if (/x\.com\/|twitter\.com\//i.test(hit.url)) s += 120;
  }

  if (/moonshot_web/i.test(hit.discoveredVia)) s += 50;
  return s;
}

/**
 * Recherche multi-sources. Retourne titres + URLs + snippets exploitables
 * même si le scrape HTML des pages est ensuite bloqué.
 */
export async function searchWebForSubject(input: {
  subject: string;
  extraQueries?: string[];
  fast?: boolean;
}): Promise<WebSearchHit[]> {
  const entities = extractSubjectEntities(input.subject);
  const queries = buildWebSearchQueries(input.subject, input.extraQueries);
  if (queries.length === 0) return [];

  const primary = queries[0]!;
  const secondary = queries.slice(1, input.fast ? 4 : 5);

  /** Moteurs directs : quelques secondes, aucun token consommé. */
  const runFreeEngines = async (): Promise<WebSearchHit[]> => {
    const batches = await Promise.all([
      searchSerper(primary).catch(() => [] as WebSearchHit[]),
      searchBrave(primary).catch(() => [] as WebSearchHit[]),
      searchBingHtml(primary).catch(() => [] as WebSearchHit[]),
      searchGoogleNews(primary).catch(() => [] as WebSearchHit[]),
      ...(input.fast
        ? []
        : [
            searchBingNews(secondary[0] || primary).catch(
              () => [] as WebSearchHit[],
            ),
            searchDuckDuckGo(secondary[0] || primary).catch(
              () => [] as WebSearchHit[],
            ),
          ]),
      ...secondary.slice(0, input.fast ? 2 : 3).map((q) =>
        searchGoogleNews(q).catch(() => [] as WebSearchHit[]),
      ),
      ...secondary.slice(0, input.fast ? 2 : 3).map((q) =>
        searchBingHtml(q).catch(() => [] as WebSearchHit[]),
      ),
    ]);
    return batches.flat();
  };

  const runMoonshot = (): Promise<WebSearchHit[]> =>
    searchMoonshotWeb(input.subject, { fast: input.fast, queries }).catch((e) => {
      console.error("moonshot web search failed", e);
      return [] as WebSearchHit[];
    });

  let merged: WebSearchHit[];

  if (input.fast) {
    // Chemin Telegram / Vercel : les moteurs directs répondent en ~8 s contre
    // ~45 s pour la boucle agentique Moonshot. On ne paie celle-ci que si les
    // requêtes d'entités n'ont pas déjà ramené l'affaire.
    const free = dedupeHits(await runFreeEngines());
    const strong = free.filter((h) => isStrongHit(h, entities));
    merged =
      strong.length >= 3
        ? free
        : dedupeHits([...(await runMoonshot()), ...free]);
  } else {
    const [moonshotHits, free] = await Promise.all([
      runMoonshot(),
      runFreeEngines(),
    ]);
    merged = dedupeHits([...moonshotHits, ...free]);
  }

  // 3) Rattrapage : trop peu de pages qui documentent vraiment le sujet.
  if (merged.filter((h) => isStrongHit(h, entities)).length < 2) {
    const focused = buildFocusedEntityQueries(input.subject);
    if (focused.length > 0) {
      const rescue = await Promise.all([
        ...focused.slice(0, input.fast ? 2 : 4).flatMap((q) => [
          searchBingHtml(q).catch(() => [] as WebSearchHit[]),
          searchGoogleNews(q).catch(() => [] as WebSearchHit[]),
        ]),
        ...(input.fast
          ? []
          : [
              searchDuckDuckGo(focused[0]!).catch(() => [] as WebSearchHit[]),
              searchSerper(focused[0]!).catch(() => [] as WebSearchHit[]),
              searchMoonshotWeb(input.subject, {
                fast: true,
                queries: focused,
              }).catch(() => [] as WebSearchHit[]),
            ]),
      ]);
      merged = dedupeHits([...merged, ...rescue.flat()]);
    }
  }

  merged.sort(
    (a, b) =>
      relevanceScore(b, input.subject, entities) -
      relevanceScore(a, input.subject, entities),
  );

  // Articles sur le sujet d'abord, simples mentions ensuite, bruit à la marge.
  const strong = merged.filter((h) => isStrongHit(h, entities));
  const onTopic = merged.filter(
    (h) => !strong.includes(h) && isOnTopicHit(h, entities),
  );
  const rest = merged.filter(
    (h) => !strong.includes(h) && !onTopic.includes(h),
  );
  const limit = input.fast ? 10 : 14;
  return [...strong, ...onTopic, ...rest.slice(0, 2)].slice(0, limit);
}
