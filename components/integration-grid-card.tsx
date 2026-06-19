"use client"

// Ported from supermemory's integration-grid-card.tsx. Recolored: blue accent (#3374FF/
// #4BA0FA) -> brand light green. Dropped the @repo/ui/@lib/fonts coupling.

import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function IntegrationGridCard({
	title,
	description,
	icon,
	pro,
	statusLabel,
	statusVariant = "neutral",
	isExternal,
	disabled,
	onClick,
}: {
	title: string
	description: string
	icon: ReactNode
	pro?: boolean
	statusLabel?: string
	statusVariant?: "connected" | "neutral"
	isExternal?: boolean
	disabled?: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"bg-surface-card relative rounded-xl p-4 pt-14",
				"border border-surface-border",
				"hover:border-brand-accent/50",
				"transition-all duration-300 cursor-pointer text-left w-full",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				"group",
			)}
		>
			{pro ? (
				<span className="absolute top-3 left-3 bg-brand-accent text-[#04130a] text-[10px] font-bold tracking-[0.3px] px-1.5 py-0.5 rounded-[3px]">
					PRO
				</span>
			) : null}
			{isExternal ? (
				<ExternalLink className="absolute top-3 left-3 size-3 text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />
			) : null}
			<div className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity">
				{icon}
			</div>
			<div className="flex-1">
				<h3 className="text-fg-primary text-sm font-medium">{title}</h3>
				<p className="text-fg-faint text-xs leading-relaxed mt-0.5">{description}</p>
				{statusLabel ? (
					<span
						className={cn(
							"inline-block mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
							statusVariant === "connected"
								? "bg-brand-accent/10 text-brand-accent"
								: "bg-fg-faint/10 text-fg-faint",
						)}
					>
						{statusLabel}
					</span>
				) : null}
			</div>
		</button>
	)
}
