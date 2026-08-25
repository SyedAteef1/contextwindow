/**
 * Audio bridge: Attendee's raw meeting audio → streaming STT → the live pipeline.
 *
 * Why this exists as a separate process:
 *
 * Meet's own captions are the default transcript source, and they are free and
 * perfectly diarised — but Google does not finalise one until it is confident
 * the speaker has stopped, which measured at 700-1,050ms on a real call. That
 * delay is most of the reason a mid-call answer feels late, and no model can
 * make it up.
 *
 * Attendee will instead stream raw PCM over a WebSocket. Holding that socket,
 * and a second one to a streaming transcriber, gets first words in ~150ms and
 * — more usefully — gives *interim* transcripts, so a question can be
 * recognised before the sentence has finished.
 *
 * It is a sidecar rather than a route handler because Next.js route handlers
 * cannot hold a WebSocket open. It keeps no state worth persisting: transcripts
 * are posted straight into the app's existing live endpoint.
 *
 *   npm run audio-bridge
 */
import "dotenv/config";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.AUDIO_BRIDGE_PORT ?? 3002);
const APP_URL = process.env.APP_URL ?? "http://localhost:3001";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";
const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY ?? "";
const SAMPLE_RATE = Number(process.env.AUDIO_SAMPLE_RATE ?? 16000);

/**
 * How long Deepgram waits for silence before declaring an utterance finished.
 *
 * This is the knob Google does not expose, and the whole reason for the
 * exercise. 300ms is aggressive — it will occasionally cut someone mid-thought
 * — but a sales question is short and landing the answer early matters more.
 */
const ENDPOINTING_MS = Number(process.env.STT_ENDPOINTING_MS ?? 300);

/**
 * Vocabulary the transcriber is primed with.
 *
 * This is the fix for the failure that started all of this: Meet's captions
 * turned "SOC 2" into "a spoke to", because a general model has no reason to
 * expect a compliance acronym in casual speech. Nova-3 accepts up to 100 key
 * terms and biases toward them — Deepgram measure confidence on a primed term
 * going from 0.71 to 0.96.
 *
 * These are the terms a B2B sales call actually turns on. Getting one wrong is
 * not a cosmetic error: "SOC 2" and "spoke to" route to completely different
 * answers, and a missed acronym means a missed cache hit.
 */
const KEYTERMS = [
  // Compliance and security — the most commonly mangled, and the highest stakes
  "SOC 2", "SOC 2 Type II", "ISO 27001", "HIPAA", "GDPR", "PCI DSS", "FedRAMP",
  "pen test", "DPA", "data residency", "encryption at rest",
  // Identity
  "SSO", "SAML", "OIDC", "SCIM", "Okta", "Azure AD", "Entra ID", "LDAP",
  // Commercial
  "MSA", "SLA", "NDA", "PoC", "ARR", "per-seat", "procurement", "net terms",
  // Technical
  "API", "webhook", "SDK", "OAuth", "REST", "GraphQL", "SIEM", "CRM", "ETL",
  "onboarding", "migration", "integration", "provisioning", "sandbox",
]
  // Anything the account itself needs — company or product names — can be added
  // per-call via STT_EXTRA_KEYTERMS without touching this list.
  .concat((process.env.STT_EXTRA_KEYTERMS ?? "").split(",").map((t) => t.trim()).filter(Boolean));

type AttendeeAudioMessage = {
  bot_id?: string;
  trigger?: string;
  data?: { chunk?: string; sample_rate?: number; timestamp_ms?: number };
};

function log(...parts: unknown[]): void {
  console.log(new Date().toISOString().slice(11, 23), ...parts);
}

/** Hand a finished utterance to the app, which owns question detection. */
async function postUtterance(botId: string, text: string, timestampMs: number): Promise<void> {
  try {
    const response = await fetch(
      `${APP_URL}/api/webhooks/bot?secret=${encodeURIComponent(WEBHOOK_SECRET)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The app deduplicates on this, and a repeated final would otherwise
          // answer the same question twice.
          idempotency_key: `stt-${botId}-${timestampMs}`,
          bot_id: botId,
          trigger: "transcript.update",
          data: {
            speaker_name: "Participant",
            timestamp_ms: timestampMs,
            transcription: { transcript: text },
          },
        }),
      },
    );
    if (!response.ok) log("app rejected utterance:", response.status, await response.text());
  } catch (error) {
    log("could not reach the app:", error instanceof Error ? error.message : error);
  }
}

/** Open a Deepgram streaming socket for one meeting. */
function openTranscriber(botId: string): WebSocket | null {
  if (!DEEPGRAM_KEY) {
    log("DEEPGRAM_API_KEY is not set — audio will be received and discarded.");
    return null;
  }

  const params = new URLSearchParams({
    model: "nova-3",
    language: "en",
    encoding: "linear16",
    sample_rate: String(SAMPLE_RATE),
    channels: "1",
    // Interim results are the point: they arrive while the speaker is still
    // talking, which is what makes answering early possible.
    interim_results: "true",
    endpointing: String(ENDPOINTING_MS),
    punctuate: "true",
    smart_format: "true",
  });

  // Repeated, not comma-joined — Deepgram rejects commas in a keyterm.
  for (const term of KEYTERMS) params.append("keyterm", term);

  const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
    headers: { Authorization: `Token ${DEEPGRAM_KEY}` },
  });

  socket.on("open", () => log(`[${botId}] transcriber connected`));
  socket.on("error", (error) => log(`[${botId}] transcriber error:`, error.message));
  socket.on("close", (code) => log(`[${botId}] transcriber closed (${code})`));

  return socket;
}

const server = createServer((_request, response) => {
  // A plain GET is a health check; everything real arrives over the upgrade.
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: true, transcriber: DEEPGRAM_KEY ? "deepgram" : "none" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (attendee) => {
  log("Attendee connected");

  let botId = "unknown";
  let transcriber: WebSocket | null = null;
  let speechStartedAt: number | null = null;
  let lastInterim = "";

  attendee.on("message", (raw) => {
    let message: AttendeeAudioMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return; // not JSON; nothing useful to do with it
    }

    if (message.bot_id && botId === "unknown") {
      botId = message.bot_id;
      transcriber = openTranscriber(botId);

      transcriber?.on("message", (payload) => {
        let event: {
          channel?: { alternatives?: { transcript?: string }[] };
          is_final?: boolean;
          speech_final?: boolean;
        };
        try {
          event = JSON.parse(payload.toString());
        } catch {
          return;
        }

        const text = event.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
        if (!text) return;

        if (!event.is_final) {
          // Interim: note when speech began so the delay can be reported.
          if (speechStartedAt === null) speechStartedAt = Date.now();
          if (text !== lastInterim) {
            lastInterim = text;
            log(`[${botId}] …${text}`);
          }
          return;
        }

        // `speech_final` means Deepgram saw the endpoint, not just a segment
        // boundary — that is the moment worth acting on.
        if (event.speech_final || event.is_final) {
          const elapsed = speechStartedAt ? Date.now() - speechStartedAt : 0;
          log(`[${botId}] FINAL (${elapsed}ms of speech): ${text}`);
          void postUtterance(botId, text, Date.now());
          speechStartedAt = null;
          lastInterim = "";
        }
      });
    }

    const chunk = message.data?.chunk;
    if (!chunk || !transcriber) return;
    if (transcriber.readyState !== WebSocket.OPEN) return;

    // Attendee sends base64 PCM; Deepgram wants the raw bytes.
    transcriber.send(Buffer.from(chunk, "base64"));
  });

  attendee.on("close", () => {
    log(`[${botId}] Attendee disconnected`);
    // Deepgram flushes and closes cleanly on this control message.
    if (transcriber?.readyState === WebSocket.OPEN) {
      transcriber.send(JSON.stringify({ type: "CloseStream" }));
    }
    transcriber?.close();
  });

  attendee.on("error", (error) => log(`[${botId}] Attendee socket error:`, error.message));
});

server.listen(PORT, () => {
  log(`audio bridge listening on ws://localhost:${PORT}`);
  log(`  transcriber : ${DEEPGRAM_KEY ? `deepgram nova-3 (endpointing ${ENDPOINTING_MS}ms)` : "NONE — set DEEPGRAM_API_KEY"}`);
  log(`  keyterms    : ${KEYTERMS.length} primed (SOC 2, SAML, SCIM, …)`);
  log(`  posting to  : ${APP_URL}/api/webhooks/bot`);
  log(`  Attendee should connect to ws://host.docker.internal:${PORT}`);
});
