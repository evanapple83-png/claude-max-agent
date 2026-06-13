// ── Channel-abstractie (Fase 4 van de Nous-parity) ────────────────────────────
// Doel: dezelfde 45 agents (die tegen grammy's Context geschreven zijn) ook op
// Discord/Slack/WhatsApp/Signal/Home Assistant laten draaien, ZONDER het bewezen
// Telegram-pad aan te raken. Een `Channel` abstraheert het versturen/bewerken/
// verwijderen van berichten + media; de context-shim (contextShim.ts) bouwt hier een
// grammy-Context-compatibel object op zodat `agent.handle(ctx, text)` ongewijzigd werkt.
//
// Het Telegram-pad in index.ts blijft native grammy — die laag is NIET via een Channel
// geïmplementeerd, juist om de live fleet niet te raken. Channels zijn voor de NIEUWE
// platforms; Telegram is de referentie die we niet verstoren.

/** Eén binnenkomend bericht, platform-onafhankelijk. */
export interface InboundMessage {
  /** Platform-chat/kanaal-id (string; Telegram-getallen worden naar string gecoerced). */
  chatId: string;
  /** Afzender-id. */
  userId: string;
  /** Platte tekst van het bericht. */
  text: string;
  /** Bijlagen (foto/video/document/audio), indien aanwezig. */
  attachments?: InboundAttachment[];
  /** Platform-native message-object, voor adapters die er meer uit willen halen. */
  raw?: unknown;
}

export interface InboundAttachment {
  kind: "photo" | "video" | "document" | "audio" | "voice";
  /** Platform-specifieke verwijzing om de bytes mee op te halen (url, file-id, …). */
  fileRef: string;
  mime?: string;
}

/** Uitgaande media: bytes of een url, met optioneel onderschrift en afmetingen. */
export interface OutMedia {
  source: Buffer | string;
  caption?: string;
  filename?: string;
  width?: number;
  height?: number;
}

/**
 * Een transport. Implementeer dit per platform (Discord/Slack/…). De id's die
 * `sendMessage` teruggeeft zijn strings; de context-shim bridget die naar de numerieke
 * message_id's die grammy-agents verwachten.
 */
export interface Channel {
  /** "discord" | "slack" | "whatsapp" | "signal" | "homeassistant" */
  readonly name: string;
  /** Kan dit platform een verzonden bericht bewerken? (WhatsApp/Signal: false → live-progress valt terug op één eindbericht.) */
  readonly supportsEdit: boolean;
  /** Ondersteunt het platform (een subset van) markdown? Zo niet, dan strippen we naar platte tekst. */
  readonly supportsMarkdown: boolean;
  /** Max. tekenlengte per bericht (chunking gebeurt in de shim). */
  readonly maxMessageLength: number;

  /** Verstuur tekst; geef de platform-message-id (string) terug. */
  sendMessage(chatId: string, text: string): Promise<string>;
  /** Bewerk een eerder verzonden bericht. Alleen aangeroepen als supportsEdit true is. */
  editMessage(chatId: string, messageId: string, text: string): Promise<void>;
  /** Verwijder een bericht (best-effort; mag no-op zijn). */
  deleteMessage(chatId: string, messageId: string): Promise<void>;

  sendPhoto(chatId: string, media: OutMedia): Promise<void>;
  sendVideo(chatId: string, media: OutMedia): Promise<void>;
  sendDocument(chatId: string, media: OutMedia): Promise<void>;

  /** Optioneel: "typing"-achtige indicator. */
  sendChatAction?(chatId: string, action: string): Promise<void>;
  /** Optioneel: haal de bytes van een binnenkomende bijlage op. */
  downloadAttachment?(fileRef: string): Promise<Buffer>;
}
