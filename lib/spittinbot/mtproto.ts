/**
 * Téléchargement des vidéos > 20 Mo : l'API Bot HTTP plafonne getFile à 20 Mo,
 * on passe donc par MTProto (GramJS) connecté avec le token du bot (limite 2 Go).
 */
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export async function downloadBotMessageMedia(messageId: number): Promise<Buffer> {
  const apiId = Number(process.env.SPITTIN_TG_API_ID);
  const apiHash = process.env.SPITTIN_TG_API_HASH;
  const token = process.env.SPITTIN_BOT_TOKEN;
  if (!apiId || !apiHash || !token) throw new Error("SPITTIN_TG_API_ID / SPITTIN_TG_API_HASH / SPITTIN_BOT_TOKEN manquants");

  const client = new TelegramClient(new StringSession(process.env.SPITTIN_TG_SESSION || ""), apiId, apiHash, {
    connectionRetries: 3,
  });
  client.setLogLevel("error" as never);
  try {
    await client.start({ botAuthToken: token });
    // En conversation privée, les identifiants de message de l'API Bot sont
    // ceux du compte du bot : messages.getMessages n'a pas besoin du peer.
    const res = await client.invoke(
      new Api.messages.GetMessages({ id: [new Api.InputMessageID({ id: messageId })] }),
    );
    const msg = "messages" in res ? res.messages[0] : undefined;
    if (!msg || !(msg instanceof Api.Message) || !msg.media) {
      throw new Error(`Message ${messageId} introuvable ou sans média`);
    }
    const data = await client.downloadMedia(msg.media, {});
    if (!data || typeof data === "string") throw new Error("Téléchargement vide");
    return Buffer.from(data);
  } finally {
    await client.disconnect().catch(() => {});
    await client.destroy().catch(() => {});
  }
}
