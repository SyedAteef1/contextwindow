// Personal-inbox domains. A brief is about a company, so "someone@gmail.com"
// gives us nothing to research — and worse, naively taking the domain would
// send us off researching Gmail itself. Shared by the form and the API.

const FREE_MAIL = new Set([
	"gmail.com",
	"googlemail.com",
	"yahoo.com",
	"yahoo.co.uk",
	"yahoo.co.in",
	"ymail.com",
	"hotmail.com",
	"hotmail.co.uk",
	"outlook.com",
	"live.com",
	"msn.com",
	"icloud.com",
	"me.com",
	"mac.com",
	"aol.com",
	"proton.me",
	"protonmail.com",
	"pm.me",
	"gmx.com",
	"gmx.net",
	"mail.com",
	"mail.ru",
	"yandex.com",
	"yandex.ru",
	"zoho.com",
	"qq.com",
	"163.com",
	"126.com",
	"rediffmail.com",
])

/** The domain part of an email-shaped string, lowercased. */
export function domainOf(input: string): string | null {
	const raw = input.trim().toLowerCase()
	if (!raw.includes("@") || raw.includes(" ")) return null
	const domain = raw.split("@").pop()
	return domain && domain.includes(".") ? domain : null
}

/** True when the input is an email at a personal-inbox provider. */
export function isPersonalInbox(input: string): boolean {
	const domain = domainOf(input)
	return domain ? FREE_MAIL.has(domain) : false
}
