// Best-effort redaction of secrets/keys before content is stored in the brain.
// Conservative: targets obvious credential shapes, leaves normal prose intact.

const RULES: Array<[RegExp, string]> = [
	[/AKIA[0-9A-Z]{16}/g, "[AWS_ACCESS_KEY]"],
	[/xox[abprs]-[A-Za-z0-9-]+/g, "[SLACK_TOKEN]"],
	[/ghp_[A-Za-z0-9]{20,}/g, "[GITHUB_TOKEN]"],
	[/sk-[A-Za-z0-9]{20,}/g, "[API_KEY]"],
	[/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[JWT]"],
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[PRIVATE_KEY]"],
	[/\b(password|passwd|secret|api[_-]?key|token|authorization)\b\s*[:=]\s*\S+/gi, "$1=[REDACTED]"],
]

export function redact(text: string): string {
	let out = text
	for (const [re, replacement] of RULES) out = out.replace(re, replacement)
	return out
}
