// AWS Bedrock — the LLM for the agent loop and memory extraction.
//
// STRICT CREDENTIAL POLICY: this uses ONLY the Bedrock credentials present in the
// environment (copied from supermemory's .env). It NEVER falls back to the ambient AWS
// credential chain (~/.aws, AWS_PROFILE, SSO, EC2/ECS instance metadata). If no Bedrock
// creds are in the env, model calls throw instead of silently using another account.

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { log } from "./log"

const region = process.env.BEDROCK_AWS_REGION?.trim() || "ap-south-1"
const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() || process.env.BEDROCK_API_KEY?.trim()
const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID?.trim()
const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY?.trim()
const sessionToken = process.env.BEDROCK_AWS_SESSION_TOKEN?.trim()

function buildProvider() {
	if (apiKey) {
		log.info("bedrock", `auth=api-key region=${region} (env-only, strict)`)
		return createAmazonBedrock({ region, apiKey })
	}
	if (accessKeyId && secretAccessKey) {
		log.info("bedrock", `auth=access-key id=${mask(accessKeyId)} region=${region} (env-only, strict)`)
		return createAmazonBedrock({
			region,
			accessKeyId,
			secretAccessKey,
			sessionToken,
			// Pin the credential provider to the env creds so the SDK can never reach for
			// ambient AWS credentials from any other account.
			credentialProvider: async () => ({ accessKeyId, secretAccessKey, sessionToken }),
		})
	}
	throw new Error(
		"No Bedrock credentials in env (set AWS_BEARER_TOKEN_BEDROCK, or BEDROCK_AWS_ACCESS_KEY_ID + " +
			"BEDROCK_AWS_SECRET_ACCESS_KEY). Refusing to use ambient AWS credentials.",
	)
}

const mask = (s: string) => (s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-4)}`)

let _provider: ReturnType<typeof createAmazonBedrock> | null = null
function provider() {
	_provider ??= buildProvider()
	return _provider
}

// APAC Claude inference profile. Override with BEDROCK_MODEL_ID.
export const BEDROCK_MODEL_ID =
	process.env.BEDROCK_MODEL_ID?.trim() || "apac.anthropic.claude-3-5-sonnet-20241022-v2:0"

/** True if any Bedrock credential is present in the env. */
export const hasBedrockCreds = Boolean(apiKey || (accessKeyId && secretAccessKey))

export const chatModel = () => provider()(BEDROCK_MODEL_ID)

// A cheaper/faster model for high-volume background work (the "Summariser Agent" in the
// memory architecture: consolidating episodic logs into facts). Defaults to the SAME model
// as the agent so it always works with whatever creds/region are configured; set
// BEDROCK_CHEAP_MODEL_ID to opt into an actually-cheaper model (e.g. a Haiku/Mistral-Small
// inference profile) once you've confirmed it's enabled in your account.
export const BEDROCK_CHEAP_MODEL_ID = process.env.BEDROCK_CHEAP_MODEL_ID?.trim() || BEDROCK_MODEL_ID

export const cheapChatModel = () => provider()(BEDROCK_CHEAP_MODEL_ID)
