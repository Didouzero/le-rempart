/**
 * Essais du circuit Claude du bot, sans base, sans Telegram et sans publication :
 * Prisma, Telegram et les chaînes de publication sont remplacés par des doublures.
 * Lancement : ../tools/claude-channel/node_modules/.bin/tsx scripts/test-claude-flow.ts
 */

import assert from "node:assert/strict";
import Module from "node:module";

process.env.TELEGRAM_BOT_TOKEN = "faux";
// Prisma charge le .env local : le vrai secret refuserait ces essais.
process.env.TELEGRAM_WEBHOOK_SECRET = "";
process.env.TELEGRAM_ALLOWED_USER_IDS = "788499709,555";
process.env.DATABASE_URL = "postgresql://nulle-part/none";

const EDITOR = 788499709;
const settings = new Map<string, { key: string; value: string; updatedAt: Date }>();
let draft: Record<string, unknown> | null = null;
const updates = new Set<number>();

const appSetting = {
  findUnique: async ({ where }: { where: { key: string } }) => settings.get(where.key) ?? null,
  create: async ({ data }: { data: { key: string; value: string } }) => {
    settings.set(data.key, { ...data, updatedAt: new Date() });
  },
  upsert: async (a: { where: { key: string }; create: { value: string } }) => {
    settings.set(a.where.key, { key: a.where.key, value: a.create.value, updatedAt: new Date() });
  },
  deleteMany: async ({ where }: { where: { key: string; value?: string } }) => {
    const row = settings.get(where.key);
    if (!row || (where.value !== undefined && row.value !== where.value)) return { count: 0 };
    settings.delete(where.key);
    return { count: 1 };
  },
  updateMany: async (a: { where: { key: string; value: string }; data: { value: string } }) => {
    const row = settings.get(a.where.key);
    if (!row || row.value !== a.where.value) return { count: 0 };
    row.value = a.data.value;
    return { count: 1 };
  },
};
const fakePrisma = {
  appSetting: {
    ...appSetting,
    delete: async ({ where }: { where: { key: string } }) => settings.delete(where.key),
  },
  $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  telegramUpdateLog: { create: async () => {} },
  publishDraft: {
    findUnique: async () => draft,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      draft = { ...draft, ...data };
      return draft;
    },
    delete: async () => {
      if (!draft) throw new Error("absent");
      draft = null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      draft = { ...data, id: "restauré", createdAt: new Date() };
    },
    upsert: async ({ create }: { create: { imageData: Buffer } }) => {
      if (create.imageData.length) {
        throw new Error("une nouvelle créative ne doit pas remplacer un brouillon en cours");
      }
      draft = { ...create, id: "site", createdAt: new Date() };
      return draft;
    },
  },
};
(globalThis as unknown as { prisma: unknown }).prisma = fakePrisma;

const published: { kind: "ready" | "kimi" | "enquete" | "facebook"; input: Record<string, unknown> }[] = [];
let failNextPublish = false;
async function fakePublish(kind: "ready" | "kimi" | "enquete" | "facebook", input: Record<string, unknown>) {
  if (failNextPublish) {
    failNextPublish = false;
    throw new Error("échec simulé");
  }
  published.push({ kind, input });
  return {};
}

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (raw: string, ...rest: unknown[]) {
  const request = raw.replace(/\.ts$/, "");
  if (request.endsWith("lib/publish-pipeline")) {
    return {
      publishReadyArticlePipeline: (i: Record<string, unknown>) => fakePublish("ready", i),
      publishBriefPipeline: (i: Record<string, unknown>) => fakePublish("kimi", i),
      publishFacebookOnlyPipeline: (i: Record<string, unknown>) => fakePublish("facebook", i),
      telegramNotifier: () => async () => {},
    };
  }
  if (request.endsWith("lib/investigation")) {
    return { publishReadyInvestigation: (i: Record<string, unknown>) => fakePublish("enquete", i) };
  }
  if (request === "next/server") {
    const real = load(request, ...rest) as object;
    return { ...real, NextResponse: { json: () => ({}) }, after: (f: () => unknown) => pending.push(f()) };
  }
  return load(raw, ...rest);
};

const pending: unknown[] = [];
const sent: string[] = [];
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  if (!String(url).startsWith("https://api.telegram.org/")) throw new Error(`réseau interdit : ${url}`);
  if (String(url).includes("/getFile")) {
    return new Response(JSON.stringify({ ok: true, result: { file_path: "a.txt" } }));
  }
  if (String(url).includes("/file/")) return new Response(READY);
  sent.push(String(JSON.parse(init?.body || "{}").text));
  return new Response(JSON.stringify({ ok: true }));
}) as typeof fetch;

const READY = `TITRE : Yannick Jadot face à CNews sur un écran noir
CHAPO : Le sénateur écologiste répond à la chaîne après sa sortie du plateau.
FLASH :
Un flash d'essai.
SOURCES : Le Monde
ARTICLE :
Corps d'essai.`;

function freshDraft(ageMs = 0) {
  draft = {
    id: "d1",
    chatId: BigInt(EDITOR),
    userId: BigInt(EDITOR),
    headline: "Titre de la créative",
    imageMime: "image/png",
    imageData: Buffer.from("x"),
    coverImageUrl: null,
    coverImageMime: "image/jpeg",
    coverImageData: Buffer.from("y"),
    coverCaption: null,
    category: "politique",
    createdAt: new Date(Date.now() - ageMs),
  };
}

function reset() {
  settings.clear();
  sent.length = 0;
  published.length = 0;
  freshDraft();
}

const macOn = () =>
  settings.set("claude-channel-heartbeat", {
    key: "claude-channel-heartbeat",
    value: new Date().toISOString(),
    updatedAt: new Date(),
  });
const macOff = () => settings.delete("claude-channel-heartbeat");
const inbox = () => [...settings.keys()].filter((k) => k.startsWith("claude-channel-inbox"));
const jobNow = () => {
  const row = settings.get("claude-article-job");
  return row ? JSON.parse(row.value) : null;
};
const clawSubmits = () =>
  appSetting.updateMany({
    where: { key: "claude-article-job", value: settings.get("claude-article-job")!.value },
    data: { value: JSON.stringify({ ...jobNow(), state: "ready", text: READY, file: "/mac/a.txt" }) },
  });

let updateId = 1;
async function say(body: Record<string, unknown>, chat = EDITOR) {
  updates.add(updateId);
  const { POST } = await import("@/app/api/telegram/webhook/route");
  await POST({
    headers: { get: () => null },
    json: async () => ({
      update_id: updateId++,
      message: { from: { id: chat }, chat: { id: chat }, ...body },
    }),
  } as never);
  await Promise.all(pending.splice(0));
}
const text = (t: string, chat?: number) => say({ text: t }, chat);

const SUBJECT = "Yannick Jadot quitte le plateau de CNews";
const PROMPT = "Enquête sur les marchés publics d'une métropole, avec les délibérations de 2025 et 2026.";
async function startEnquete() {
  await text("/enquete");
  await text(PROMPT);
}
const photo = (id: string) => say({ photo: [{ file_id: id, width: 10, height: 10 }] });

const tests: [string, () => Promise<void>][] = [
  ["Mac disponible : sujet en file, brouillon gardé, rien de publié", async () => {
    macOn();
    await text(SUBJECT);
    assert.equal(inbox().length, 1);
    assert.match(settings.get(inbox()[0]!)!.value, /\[REMPART article [0-9a-f]{8}\]/);
    assert.equal(jobNow().state, "writing");
    assert.ok(draft);
    assert.equal(published.length, 0);
    assert.match(sent.at(-1)!, /Claude cherche et rédige/);
  }],
  ["« ok » avant le texte ne publie pas", async () => {
    macOn();
    await text(SUBJECT);
    await text("ok");
    assert.equal(published.length, 0);
    assert.match(sent.at(-1)!, /rien n’est publié/);
  }],
  ["retouche : file, plus de « ok » possible jusqu'à la nouvelle version", async () => {
    macOn();
    await text(SUBJECT);
    await clawSubmits();
    await text("ok mais change le titre");
    assert.equal(published.length, 0);
    assert.equal(jobNow().state, "writing");
    assert.equal(inbox().length, 2);
    assert.ok(inbox().some((k) => /retouche/.test(settings.get(k)!.value)));
    assert.ok(inbox().some((k) => /\/mac\/a\.txt/.test(settings.get(k)!.value)));
    await text("OK");
    assert.equal(published.length, 0);
  }],
  ["« ok » publie le texte exact une seule fois", async () => {
    macOn();
    await text(SUBJECT);
    await clawSubmits();
    await text("Ok !");
    assert.equal(published.length, 1);
    assert.equal(published[0]!.kind, "ready");
    assert.equal((published[0]!.input.ready as { flash: string }).flash.includes("flash d'essai"), true);
    assert.equal(published[0]!.input.category, "politique");
    assert.equal(jobNow(), null);
    assert.equal(draft, null);
    await text("ok");
    assert.equal(published.length, 1);
  }],
  ["publication en échec : suivi et brouillon rendus, rubrique comprise", async () => {
    macOn();
    await text(SUBJECT);
    await clawSubmits();
    failNextPublish = true;
    await text("ok");
    assert.equal(jobNow().state, "ready");
    assert.equal(draft?.category, "politique");
    assert.match(sent.at(-1)!, /Erreur : échec simulé/);
    await text("ok");
    assert.equal(published.length, 1);
  }],
  ["brouillon de plus de 30 min gardé tant que l'article est en cours", async () => {
    macOn();
    await text(SUBJECT);
    await clawSubmits();
    freshDraft(5 * 3600 * 1000);
    await text("ok");
    assert.equal(published.length, 1);
  }],
  ["Mac indisponible : rien ne part, Kimi attend la confirmation", async () => {
    macOff();
    await text(SUBJECT);
    assert.equal(inbox().length, 0);
    assert.equal(published.length, 0);
    assert.equal(jobNow().state, "kimi-offer");
    assert.match(sent.at(-1)!, /Le Mac n’est pas disponible/);
    await text("kimi");
    assert.equal(published[0]!.kind, "kimi");
    assert.equal(published[0]!.input.brief, SUBJECT);
    assert.equal(jobNow(), null);
  }],
  ["battement vieux de plus de 2 minutes : Mac indisponible", async () => {
    settings.set("claude-channel-heartbeat", {
      key: "claude-channel-heartbeat",
      value: new Date(Date.now() - 121_000).toISOString(),
      updatedAt: new Date(),
    });
    await text(SUBJECT);
    assert.equal(jobNow().state, "kimi-offer");
  }],
  ["sujet renvoyé quand le Mac revient : il part chez Claude", async () => {
    macOff();
    await text(SUBJECT);
    macOn();
    await text(`${SUBJECT}, avec l'angle de la réponse de la chaîne`);
    assert.equal(jobNow().state, "writing");
    assert.equal(inbox().length, 1);
    assert.equal(published.length, 0);
  }],
  ["Mac coupé pendant une retouche : la dernière version reste validable", async () => {
    macOn();
    await text(SUBJECT);
    await clawSubmits();
    await text("raccourcis le chapô");
    macOff();
    await text("alors ?");
    assert.equal(jobNow().state, "ready");
    assert.equal(published.length, 0);
    await text("ok");
    assert.equal(published.length, 1);
  }],
  ["Claude muet malgré le battement : « kimi » reprend la main", async () => {
    macOn();
    await text(SUBJECT);
    await text("kimi");
    assert.equal(published[0]!.kind, "kimi");
    assert.ok(inbox().some((k) => /abandon/.test(settings.get(k)!.value)));
  }],
  ["/cancel prévient Claude et retire tout", async () => {
    macOn();
    await text(SUBJECT);
    await text("/cancel");
    assert.equal(jobNow(), null);
    assert.equal(draft, null);
    assert.ok(inbox().some((k) => /abandon/.test(settings.get(k)!.value)));
    assert.equal(published.length, 0);
  }],
  ["nouvelle créative pendant un article : refusée", async () => {
    macOn();
    await text(SUBJECT);
    await say({ photo: [{ file_id: "p", width: 10, height: 10 }] });
    assert.equal((draft as { id: string }).id, "d1");
    assert.match(sent.at(-1)!, /Claude rédige/);
  }],
  ["texte prêt collé ou .txt : toujours publié, sans passer par la file", async () => {
    macOn();
    await text(READY);
    assert.equal(published[0]!.kind, "ready");
    assert.equal(inbox().length, 0);
    freshDraft();
    await text(SUBJECT);
    await say({ document: { file_id: "t", file_name: "a.txt", mime_type: "text/plain", file_size: 100 } });
    assert.equal(published[1]!.kind, "ready");
    assert.equal(jobNow(), null);
  }],
  ["enquête : part chez Claude, rien de lancé chez Kimi, publiée au « ok » seulement", async () => {
    draft = null;
    macOn();
    await startEnquete();
    assert.equal(jobNow().kind, "enquete");
    assert.ok(inbox().some((k) => /\[REMPART enquête/.test(settings.get(k)!.value)));
    assert.equal(published.length, 0);
    await text("ok");
    await text("kimi");
    assert.equal(published.length, 0);
    assert.equal(jobNow().state, "writing");
    await clawSubmits();
    await text("change l'intertitre");
    assert.equal(jobNow().state, "writing");
    assert.equal(published.length, 0);
    await clawSubmits();
    await text("texte");
    assert.ok(sent.some((m) => m.startsWith("TITRE")));
    await text("pas ok");
    assert.equal(jobNow().state, "ready");
    assert.equal(published.length, 0);
    await text("ok");
    assert.equal(jobNow().state, "awaiting-media");
    assert.match(sent.at(-1)!, /créative/);
    await text("un mot");
    assert.match(sent.at(-1)!, /créative/);
    await photo("creative");
    assert.match(sent.at(-1)!, /illustration/);
    await text("toujours rien");
    assert.match(sent.at(-1)!, /illustration/);
    await photo("illustration");
    assert.match(sent.at(-1)!, /texte alt/);
    assert.equal(published.length, 0);
    await text("Le conseil métropolitain en séance");
    assert.equal(published[0]!.kind, "enquete");
    assert.equal(published[0]!.input.fileId, "creative");
    assert.equal(published[0]!.input.coverFileId, "illustration");
    assert.equal(published[0]!.input.coverAlt, "Le conseil métropolitain en séance");
    assert.equal(jobNow(), null);
  }],
  ["texte alt dans la légende : publication sans question de plus", async () => {
    draft = null;
    macOn();
    await startEnquete();
    await clawSubmits();
    await text("ok");
    await photo("creative");
    await say({ photo: [{ file_id: "illustration", width: 10, height: 10 }], caption: "Le conseil en séance" });
    assert.equal(published[0]!.input.coverAlt, "Le conseil en séance");
  }],
  ["enquête en échec de publication : le texte reste à valider", async () => {
    draft = null;
    macOn();
    await startEnquete();
    await clawSubmits();
    await text("ok");
    await photo("creative");
    await photo("illustration");
    failNextPublish = true;
    await text("Le conseil en séance");
    assert.equal(jobNow().state, "ready");
    assert.equal(jobNow().coverFileId, "illustration");
    await text("ok");
    assert.equal(published.length, 1);
  }],
  ["enquête VPS éteint : refusée sans Kimi, renvoyable au retour", async () => {
    draft = null;
    macOff();
    await startEnquete();
    assert.equal(jobNow(), null);
    assert.equal(published.length, 0);
    assert.match(sent.at(-1)!, /VPS n’est pas disponible/);
    macOn();
    await text(PROMPT);
    assert.equal(jobNow().kind, "enquete");
  }],
  ["enquête annulée : Claude prévenu", async () => {
    draft = null;
    macOn();
    await startEnquete();
    await text("/cancel");
    assert.equal(jobNow(), null);
    assert.ok(inbox().some((k) => /abandon/.test(settings.get(k)!.value)));
  }],
  ["/site : titre de l'illustration, rubrique, sujet, sans Facebook", async () => {
    macOn();
    draft = null;
    await text("/site");
    assert.equal((draft as unknown as { imageData: Buffer }).imageData.length, 0);
    assert.match(sent.at(-1)!, /rien sur Facebook/);
    await text("sans illustration");
    assert.match(sent.at(-1)!, /J’attends encore l’illustration/);
    Object.assign(draft!, { coverImageMime: "image/jpeg", coverImageData: Buffer.from("y") });
    await text(SUBJECT);
    assert.equal(draft!.coverCaption, SUBJECT);
    assert.match(sent.at(-1)!, /Dans quelle rubrique/);
    draft!.category = "politique";
    await text(SUBJECT);
    assert.match(settings.get(inbox()[0]!)!.value, /site seul/);
    await clawSubmits();
    await text("ok");
    assert.match(sent.join("\n"), /sur le site uniquement/);
    assert.equal(published.length, 1);
    assert.equal(published[0]!.kind, "ready");
    assert.equal((published[0]!.input.image as { buffer: Buffer }).buffer.length, 0);
  }],
  ["/facebook : créative, sujet, flash, sans article ni Kimi", async () => {
    macOn();
    draft = null;
    await text("/facebook");
    assert.equal(draft!.coverImageUrl, "facebook-only");
    await text(SUBJECT);
    assert.match(sent.at(-1)!, /J’attends la créative/);
    Object.assign(draft!, { imageMime: "image/png", imageData: Buffer.from("x") });
    await text(SUBJECT);
    assert.equal(jobNow().kind, "flash");
    assert.match(settings.get(inbox()[0]!)!.value, /\[REMPART flash /);
    await text("kimi");
    assert.match(sent.at(-1)!, /ne passe pas par Kimi/);
    await appSetting.updateMany({
      where: { key: "claude-article-job", value: settings.get("claude-article-job")!.value },
      data: { value: JSON.stringify({ ...jobNow(), state: "ready", text: "FLASH :\nUn flash." }) },
    });
    await text("ok");
    assert.equal(published.length, 1);
    assert.equal(published[0]!.kind, "facebook");
    assert.equal(published[0]!.input.text, "FLASH :\nUn flash.");
    assert.equal(jobNow(), null);
    assert.equal(draft, null);
  }],
  ["/facebook sans VPS : rien en file, pas de Kimi", async () => {
    macOff();
    draft = null;
    await text("/facebook");
    Object.assign(draft!, { imageMime: "image/png", imageData: Buffer.from("x") });
    await text(SUBJECT);
    assert.equal(jobNow(), null);
    assert.match(sent.at(-1)!, /VPS n’est pas disponible/);
  }],
  ["/site refusé pendant une rédaction", async () => {
    macOn();
    await text(SUBJECT);
    await text("/site");
    assert.match(sent.at(-1)!, /Claude travaille déjà/);
    assert.equal(draft!.id, "d1");
  }],
  ["un autre compte autorisé reste sur Kimi", async () => {
    macOn();
    draft!.chatId = BigInt(555);
    await text(SUBJECT, 555);
    assert.equal(inbox().length, 0);
    assert.equal(jobNow().state, "kimi-offer");
  }],
];

async function main() {
  const { claudeJobAction, isApproval, isHeartbeatFresh } = await import("@/lib/claude-job");
  for (const t of ["ok", "OK", "Ok.", " ok ! "]) assert.ok(isApproval(t), t);
  for (const t of ["okay", "ok mais non", "pas ok", "o k", ""]) assert.ok(!isApproval(t), t);
  const { finishReadyFlash } = await import("@/lib/ready-article");
  assert.deepEqual(finishReadyFlash("FLASH :\nUn flash d'essai.").issues, []);
  assert.throws(() => finishReadyFlash("Sans repère"), /Flash incomplet/);
  assert.equal(claudeJobAction("ready", "/foo", true), "status");
  assert.equal(claudeJobAction("writing", "", true), "status");
  assert.equal(claudeJobAction("ready", "Kimi.", true), "kimi");
  assert.equal(claudeJobAction("ready", "corrige", false), "mac-down");
  assert.equal(claudeJobAction("writing", "précision", true), "complement");
  assert.equal(claudeJobAction("kimi-offer", "ok", true), "new-subject");
  assert.ok(isHeartbeatFresh(new Date(1000).toISOString(), 1000 + 119_000));
  assert.ok(!isHeartbeatFresh(new Date(1000).toISOString(), 1000 + 120_000));
  assert.ok(!isHeartbeatFresh(undefined));
  console.log("ok parseurs et transitions");

  for (const [name, run] of tests) {
    reset();
    await run();
    console.log(`ok ${name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
