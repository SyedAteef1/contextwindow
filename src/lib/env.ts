/**
 * Typed environment access.
 *
 * Parsed lazily so that `next build` (which imports route modules without a
 * real environment) doesn't crash on a missing secret. Anything genuinely
 * required is asserted at the point of use via `requireEnv`.
 */
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- App ---------------------------------------------------------------
  /** Where the signed-in product lives. OAuth returns here. */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Where the public site lives, when it is a different host.
   *
   * Marketing on the apex and the product on a subdomain is the arrangement
   * buyers expect, and it keeps a stranger off the app entirely. Unset, both
   * are the same origin and nothing below changes.
   */
  MARKETING_URL: z.string().url().optional(),
  /**
   * The cookie scope, when the session has to be readable on both hosts.
   *
   * A cookie set on `sales.example.com` is invisible to `example.com`, so the
   * public site could not tell a signed-in visitor from a stranger. Setting
   * `.example.com` shares it across both. Leave unset for a single host — a
   * domain-scoped cookie on localhost is silently dropped.
   */
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-session-secret"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),

  // --- Database ----------------------------------------------------------
  DATABASE_URL: z.string().default("postgres://sales:sales@localhost:5432/sales_intel"),

  // --- LLM provider ------------------------------------------------------
  /**
   * `anthropic` talks to Claude directly. `glm` talks to Z.ai's GLM models
   * through their Anthropic-compatible endpoint using the same SDK — the
   * differences in what each supports are handled in `src/lib/llm/providers.ts`.
   */
  LLM_PROVIDER: z.enum(["anthropic", "glm"]).default("anthropic"),

  // --- Anthropic ---------------------------------------------------------
  ANTHROPIC_API_KEY: z.string().optional(),
  // The build spec calls for Sonnet; `claude-opus-5` is a drop-in upgrade.
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  // --- Fast lane (live in-call answers only) -----------------------------
  /**
   * A second, latency-optimised model used *only* by the live agent.
   *
   * The wrap-up agent generates hundreds of tokens and can take 40 seconds; a
   * mid-call answer has under a second before it is useless. Different jobs,
   * different models.
   *
   * Any OpenAI-compatible endpoint works — the named ones are presets for
   * their base URLs. `none` falls back to the main provider.
   */
  FAST_LLM_PROVIDER: z.enum(["cerebras", "openrouter", "openai-compatible", "none"]).default("none"),
  /** Overrides the preset base URL. Required for `openai-compatible`. */
  FAST_LLM_BASE_URL: z.string().optional(),
  /** Overrides the provider-specific key below. */
  FAST_LLM_API_KEY: z.string().optional(),
  FAST_LLM_MODEL: z.string().default("gemma-4-31b"),
  /** Give up and show nothing rather than a stale answer mid-call. */
  FAST_LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(4000),
  /**
   * OpenRouter only: pin which upstream serves the model, e.g. `Cerebras`.
   * This is how you reach GLM on wafer-scale hardware without a Code plan.
   */
  OPENROUTER_PROVIDER_ORDER: z.string().optional(),
  /**
   * Some endpoints (gpt-oss on Cerebras) mandate reasoning and reject
   * `enabled: false`. `low` is accepted and costs only a handful of tokens,
   * which is the difference between a 650ms answer and no answer at all.
   */
  /**
   * How much the fast model may think before answering.
   *
   * `minimal` by default, and the gap is not subtle: measured against
   * `openai/gpt-oss-120b` on Cerebras, `low` took **15.6 seconds** to the first
   * content token while `minimal` took **430ms** — the model reasons at length
   * before emitting anything. At `low` the fast lane never beat its own timeout,
   * so every live answer silently fell back to the main model and the whole
   * lane contributed nothing.
   */
  FAST_LLM_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high"])
    .default("minimal"),

  CEREBRAS_API_KEY: z.string().optional(),
  CEREBRAS_BASE_URL: z.string().default("https://api.cerebras.ai/v1"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),

  // --- GLM (Z.ai) --------------------------------------------------------
  GLM_API_KEY: z.string().optional(),
  /** Z.ai's Anthropic-compatible endpoint. */
  GLM_BASE_URL: z.string().default("https://api.z.ai/api/anthropic"),
  GLM_MODEL: z.string().default("glm-5.3"),
  /**
   * GLM's native REST surface, used for web search — the Anthropic-compatible
   * endpoint carries no server-side search tool.
   */
  GLM_API_BASE_URL: z.string().default("https://api.z.ai/api/paas/v4"),
  GLM_SEARCH_ENGINE: z.string().default("search_std"),

  // --- Web search --------------------------------------------------------
  /**
   * Serper returns Google's index plus its knowledge panel, which is markedly
   * better for company research than a provider-bundled search. `auto` picks it
   * whenever a key exists and falls back to Z.ai otherwise, so a deployment
   * without one still produces briefs.
   */
  SERPER_API_KEY: z.string().optional(),
  SEARCH_PROVIDER: z.enum(["auto", "serper", "zai"]).default("auto"),
  ANTHROPIC_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("high"),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(16000),
  /** Web search can stop a turn with `pause_turn`; cap how often we resume. */
  ANTHROPIC_MAX_PAUSE_RESTARTS: z.coerce.number().int().nonnegative().default(5),

  // --- Embeddings --------------------------------------------------------
  /**
   * `local` covers any OpenAI-compatible embedding server — Ollama, TEI,
   * Infinity, vLLM, LM Studio — which is how the open-weight models are served.
   * `hash` is a deterministic offline stand-in so RAG is testable with no key.
   */
  EMBEDDING_PROVIDER: z.enum(["voyage", "local", "glm", "hash"]).default("hash"),
  EMBEDDING_MODEL: z.string().default("voyage-3.5-lite"),
  VOYAGE_API_KEY: z.string().optional(),

  /** OpenAI-compatible embeddings endpoint. Ollama's default is shown. */
  EMBEDDING_BASE_URL: z.string().default("http://localhost:11434/v1"),
  EMBEDDING_API_KEY: z.string().optional(),
  /**
   * Optional sparse-vector endpoint (e.g. TEI's `/embed_sparse`). Only BGE-M3
   * produces lexical weights; without this, retrieval stays dense-only.
   */
  EMBEDDING_SPARSE_URL: z.string().optional(),
  /** Fuse dense and sparse results. Requires a sparse-capable model + endpoint. */
  HYBRID_SEARCH: z.coerce.boolean().default(false),
  /** Reciprocal-rank-fusion constant. 60 is the value from the original paper. */
  HYBRID_RRF_K: z.coerce.number().int().positive().default(60),
  /** pgvector's sparsevec caps non-zero elements; keep the heaviest weights. */
  SPARSE_MAX_TERMS: z.coerce.number().int().positive().max(1000).default(400),
  /**
   * GLM embeddings live on the legacy BigModel platform, not on the
   * international z.ai host — see docs/DECISIONS.md.
   */
  GLM_EMBEDDING_BASE_URL: z.string().default("https://open.bigmodel.cn/api/paas/v4"),
  GLM_EMBEDDING_MODEL: z.string().default("embedding-3"),
  GLM_EMBEDDING_API_KEY: z.string().optional(),
  /** Must match the pgvector column dimension in the schema. */
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(8),
  /**
   * How close a live question must be to a precomputed one to reuse its answer.
   *
   * This is the risk surface for the cache: too low and a pricing question gets
   * the security answer, which is worse than no answer because the rep may read
   * it aloud. A miss simply falls through to the model, so err high.
   */
  PRECOMPUTED_MIN_SIMILARITY: z.coerce.number().default(0.82),

  // --- Google ------------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /**
   * Where Google sends the user back. Left unset it is derived from `APP_URL`,
   * because the two must agree and a hardcoded default silently disagrees the
   * moment the app is deployed anywhere — producing a `redirect_uri_mismatch`
   * that looks like a console misconfiguration rather than a stale default.
   */
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  /**
   * Email each brief to the rep as soon as it is written.
   *
   * On by default: a brief nobody opens is worth nothing, and it is usually
   * written days before the call. Only ever sent to the rep themselves.
   */
  BRIEF_EMAIL_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  // --- Notifications -----------------------------------------------------
  /**
   * Post into a named channel with the bot token.
   *
   * Preferred over a webhook: a webhook is welded to whichever channel was
   * picked when it was created, so moving the alerts means re-issuing the URL.
   * A channel id can be changed here. The bot needs `chat:write` and has to be
   * invited to the channel — Slack will not post into a room it is not in.
   */
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_ID: z.string().optional(),
  /**
   * Who to tag, so the alert is a notification rather than a message in a room
   * nobody has open. A member id (`U…`, from Slack profile → Copy member ID),
   * or `!here` / `!channel` for the whole room.
   */
  SLACK_MENTION: z.string().optional(),
  /** A webhook still works where there is no bot token. */
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  /** Where sign-up and demo-request alerts go by email. Needs the SMTP sender. */
  NOTIFY_EMAIL: z.string().optional(),

  // --- Outbound mail -----------------------------------------------------
  /**
   * Who the mail comes from.
   *
   * `gmail` sends through the rep's own mailbox using their OAuth grant, so a
   * reply reaches a human and the message sits in their Sent folder. `smtp`
   * sends from a company address instead, which is what you want for anything
   * that should look like it came from the business rather than a person.
   */
  MAIL_PROVIDER: z.enum(["gmail", "smtp"]).default("gmail"),
  /** e.g. `Context Window <sales@contextwindowhq.com>`. Required for smtp. */
  MAIL_FROM: z.string().optional(),
  /** Where replies should land, when that is not the From address. */
  MAIL_REPLY_TO: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** Implicit TLS on 465; STARTTLS on 587. Derived from the port by default. */
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),

  CALENDAR_LOOKAHEAD_DAYS: z.coerce.number().int().positive().default(14),

  // --- Meeting bot -------------------------------------------------------
  /**
   * `mock` simulates a full bot lifecycle with a canned transcript, so the
   * post-call pipeline can be exercised without Attendee or a public webhook
   * URL. `noop` schedules nothing at all.
   */
  /**
   * What the bot records.
   *
   * `mp4` keeps the video, which is what people expect from a call recording —
   * you can see the deck, and who was talking. It costs roughly 13.8 MiB per
   * minute against about 1 for audio, and asks more of the bot's CPU, so a
   * deployment running many concurrent bots on a small host can drop to `mp3`
   * and lose only the picture.
   */
  RECORDING_FORMAT: z.enum(["mp4", "mp3"]).default("mp4"),

  BOT_PROVIDER: z.enum(["attendee", "meetingbot", "mock", "noop"]).default("attendee"),
  /** Your self-hosted Attendee; https://app.attendee.dev is the hosted fallback. */
  ATTENDEE_BASE_URL: z.string().default("https://app.attendee.dev"),
  ATTENDEE_API_KEY: z.string().optional(),
  MEETINGBOT_BASE_URL: z.string().optional(),
  MEETINGBOT_API_KEY: z.string().optional(),
  BOT_DISPLAY_NAME: z.string().default("Sales Notetaker"),
  /** Bot joins this many minutes before the scheduled start. */
  BOT_JOIN_LEAD_MINUTES: z.coerce.number().int().nonnegative().default(10),
  /**
   * WebSocket the bot streams raw meeting audio to.
   *
   * Set this to run transcription ourselves instead of using the meeting
   * platform's captions — the platform waits ~700-1,050ms to finalise an
   * utterance, and we can endpoint far more aggressively. Attendee runs in
   * Docker, so from its perspective this is `host.docker.internal`.
   */
  AUDIO_BRIDGE_URL: z.string().optional(),
  AUDIO_SAMPLE_RATE: z.coerce.number().int().default(16000),

  /** Appended to our webhook URL so forged posts can be rejected. */
  WEBHOOK_SECRET: z.string().default("dev-only-insecure-webhook-secret"),
  /**
   * Overrides the origin used for bot webhooks.
   *
   * Two cases need it. A tunnel, where the public HTTPS address differs from
   * APP_URL. And a self-hosted Attendee in Docker, which cannot resolve
   * `localhost` to the host — that needs `http://host.docker.internal:3001`
   * plus `REQUIRE_HTTPS_WEBHOOKS=false` on the Attendee side.
   *
   * Set deliberately, so the HTTPS check is skipped only when you mean it.
   */
  WEBHOOK_BASE_URL: z.string().optional(),
  /** Guards the Vercel Cron endpoints. */
  CRON_SECRET: z.string().default("dev-only-insecure-cron-secret"),

  // --- Transcription fallback --------------------------------------------
  // Only consulted when the bot provider returns audio instead of text.
  TRANSCRIPTION_PROVIDER: z.enum(["none", "deepgram", "assemblyai"]).default("none"),
  DEEPGRAM_API_KEY: z.string().optional(),
  ASSEMBLYAI_API_KEY: z.string().optional(),

  // --- Free tier ---------------------------------------------------------
  FREE_TIER_MEETING_LIMIT: z.coerce.number().int().positive().default(5),
});

/**
 * `GOOGLE_REDIRECT_URI` is optional in the schema but always present here: it
 * is filled from `APP_URL` when unset, so callers never have to handle absence.
 */
export type Env = z.infer<typeof schema> & { GOOGLE_REDIRECT_URI: string };

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
      );
    }
    cached = {
      ...parsed.data,
      GOOGLE_REDIRECT_URI:
        parsed.data.GOOGLE_REDIRECT_URI ??
        `${parsed.data.APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`,
    };
  }
  return cached;
}

/**
 * Something the deployment has not been given yet.
 *
 * Distinct from a runtime failure: nothing is broken, a value is simply
 * missing, and the fix is a configuration change rather than a retry.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** Assert an optional variable is present at the point it is actually needed. */
export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (value === undefined || value === null || value === "") {
    throw new ConfigurationError(
      `${String(key)} is not set. Add it to your environment — see .env.example.`,
    );
  }
  return value as NonNullable<Env[K]>;
}

/**
 * Discard the parsed environment.
 *
 * `env()` parses `process.env` once and caches it, which is what we want in a
 * long-lived process — but it means a variable set after the first call is
 * ignored. Tests that manipulate the environment need this seam.
 */
export function resetEnvCache(): void {
  cached = null;
}

export const isProduction = () => env().NODE_ENV === "production";
