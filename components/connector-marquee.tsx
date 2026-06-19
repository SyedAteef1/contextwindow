// Infinite, theme-matched connector marquee. Every brand icon is forced to a single
// monochrome tone (`[&_path]:fill-current` + `text-white/…`) so the colorful brand logos
// blend into our dark glass theme instead of clashing with it.

import {
	Slack as SlackIcon,
	Gmail,
	GoogleDrive,
	GitHub,
	OneDrive,
	McpIcon,
	NotionDoc,
} from "@/components/integration-icons"

// Just the services you connect — not individual file types.
const CONNECTORS = [
	{ label: "Slack", icon: SlackIcon },
	{ label: "Claude / MCP", icon: McpIcon },
	{ label: "Notion", icon: NotionDoc },
	{ label: "Gmail", icon: Gmail },
	{ label: "Google Drive", icon: GoogleDrive },
	{ label: "GitHub", icon: GitHub },
	{ label: "OneDrive", icon: OneDrive },
]

export function ConnectorMarquee() {
	// Render the list twice so the -50% translate loops seamlessly.
	const items = [...CONNECTORS, ...CONNECTORS]
	return (
		<div className="marquee-mask group relative overflow-hidden">
			<div className="animate-marquee flex w-max items-center gap-3 group-hover:[animation-play-state:paused]">
				{items.map((c, i) => {
					const Icon = c.icon
					return (
						<div
							key={`${c.label}-${i}`}
							className="liquid-glass shrink-0 rounded-full pl-3.5 pr-4 py-2.5 flex items-center gap-2.5 text-[#4ade80]/80 hover:text-[#86efac] transition-colors"
						>
							<Icon className="w-5 h-5 shrink-0 [&_path]:fill-current" />
							<span className="text-sm font-medium whitespace-nowrap text-white/85">{c.label}</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}
