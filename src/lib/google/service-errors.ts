/**
 * Google's "you never turned this API on" response, made legible.
 *
 * A disabled API comes back as a 403 whose body reads like a permissions
 * failure, so it surfaces as an opaque 500 and sends you hunting through OAuth
 * scopes and consent screens. It is none of those things: the project simply
 * has not enabled the API, and the fix is one click on a URL Google already
 * includes in the response.
 */
export function serviceDisabledMessage(body: string): string | null {
  if (!body.includes("SERVICE_DISABLED")) return null;
  try {
    const parsed = JSON.parse(body) as {
      error?: { details?: { reason?: string; metadata?: Record<string, string> }[] };
    };
    const info = parsed.error?.details?.find((detail) => detail.reason === "SERVICE_DISABLED");
    const title = info?.metadata?.serviceTitle ?? "A Google API";
    const url = info?.metadata?.activationUrl;
    return `${title} is not enabled for this Google Cloud project.${
      url ? ` Enable it at ${url} and try again.` : ""
    }`;
  } catch {
    // The shape changed but the reason code is still there; say the useful part.
    return "A required Google API is not enabled for this Google Cloud project.";
  }
}
