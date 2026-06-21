"use client"

/* eslint-disable react/no-unescaped-entities -- demo copy contains apostrophes by design */

// The "See it in action" Slack mock. It cycles slowly through a few real-feeling
// questions (with pager dots) so the demo feels alive, with on-theme green avatars.
// One pair of scenes tells the escalation→learning story: when the brain isn't sure it
// routes the question to the engineer who owns that work, answers, and remembers it so
// next time it replies instantly from memory.

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CornerDownRight, Sparkles, BrainCircuit } from "lucide-react"
import { Slack as SlackIcon } from "@/components/integration-icons"

type Scene = {
	channel: string
	initials: string
	avatar: string // tailwind gradient classes
	emoji: string // cartoon avatar face
	name: string
	time: string
	question: React.ReactNode
	via?: { icon: "route" | "memory"; text: React.ReactNode } // escalation / memory step
	answer: React.ReactNode
	sources: string[]
	learned?: string // green pill under the answer
}

const SCENES: Scene[] = [
	{
		channel: "sales",
		initials: "SR",
		avatar: "from-emerald-400 to-teal-600",
		emoji: "👩‍💼",
		name: "Sarah",
		time: "9:41 AM",
		question: <>where did we land on Acme's renewal pricing?</>,
		answer: (
			<>
				Acme agreed to a <span className="font-semibold text-white">12-month renewal at $48k</span> (up from $40k), with a 2-week pilot of the analytics add-on. Confirmed by David on the Jun 14 call; legal is drafting now.
			</>
		),
		sources: ["call-notes · Jun 14", "#sales", "acme_renewal.pdf"],
	},
	{
		channel: "product",
		initials: "JK",
		avatar: "from-green-400 to-emerald-600",
		emoji: "👨‍💻",
		name: "Jack",
		time: "10:02 AM",
		question: <>what's still blocking the mobile release?</>,
		answer: (
			<>
				Two P0s remain: the <span className="font-semibold text-white">onboarding crash</span> (fix in review by Sam) and the push-token bug. ETA is <span className="font-semibold text-white">Thursday</span> per this morning's standup.
			</>
		),
		sources: ["standup · Jun 18", "#product", "LIN-1423"],
	},
	{
		channel: "sales",
		initials: "RY",
		avatar: "from-teal-400 to-green-600",
		emoji: "🧑‍💼",
		name: "Ryan",
		time: "2:14 PM",
		question: <>does our API support webhook retries? customer's asking.</>,
		via: {
			icon: "route",
			text: (
				<>
					Not in memory yet — asking <span className="text-[#86efac] font-medium">@Sam</span>, who shipped the webhooks work (PR #2210)…
				</>
			),
		},
		answer: (
			<>
				Yes. Webhooks <span className="font-semibold text-white">retry up to 5× with exponential backoff over 24h</span>; anything still failing lands in a dead-letter queue you can replay from the dashboard.
			</>
		),
		sources: ["@Sam · eng", "PR #2210", "#product"],
		learned: "Learned — I'll answer this instantly next time",
	},
	{
		channel: "sales",
		initials: "EM",
		avatar: "from-emerald-500 to-green-700",
		emoji: "👩‍🦰",
		name: "Emma",
		time: "Next week",
		question: <>do our webhooks retry on failure?</>,
		via: {
			icon: "memory",
			text: (
				<>
					Answered straight from memory — no need to interrupt engineering this time.
				</>
			),
		},
		answer: (
			<>
				Yes — <span className="font-semibold text-white">up to 5× with exponential backoff over 24h</span>, then dead-letter for replay. I learned this from Sam last week.
			</>
		),
		sources: ["memory · learned Jun 18", "PR #2210"],
		learned: "Answered from memory · 0 interruptions",
	},
]

const ROTATE_MS = 6500

export function SalesDemo() {
	const [i, setI] = useState(0)

	// setTimeout keyed on `i` so a manual dot tap also resets the countdown.
	useEffect(() => {
		const t = setTimeout(() => setI((p) => (p + 1) % SCENES.length), ROTATE_MS)
		return () => clearTimeout(t)
	}, [i])

	const s = SCENES[i]

	return (
		<div className="lg:col-span-3 flex flex-col">
			<div className="liquid-glass-strong rounded-3xl p-6 sm:p-8 border border-white/10 min-h-[340px]">
				<div className="flex items-center gap-2 pb-5 mb-5 border-b border-white/10">
					<SlackIcon className="w-4 h-4 [&_path]:fill-[#4ade80]" />
					<AnimatePresence mode="wait">
						<motion.span
							key={s.channel + i}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="text-sm font-semibold text-white/80"
						>
							#{s.channel}
						</motion.span>
					</AnimatePresence>
					<span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/40">
						<span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" /> live
					</span>
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={i}
						initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
						transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
					>
						{/* Asker */}
						<div className="flex gap-3 mb-4">
							<div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.avatar} ring-1 ring-white/20 flex items-center justify-center text-lg leading-none shrink-0 shadow-lg select-none`} aria-label={s.name}>
								<span aria-hidden>{s.emoji}</span>
							</div>
							<div>
								<div className="flex items-baseline gap-2">
									<span className="text-sm font-semibold text-white">{s.name}</span>
									<span className="text-[11px] text-white/40">{s.time}</span>
								</div>
								<p className="text-sm text-white/80 mt-1">
									<span className="text-[#7AB7FF]">@Context Window</span> {s.question}
								</p>
							</div>
						</div>

						{/* Optional escalation / memory step */}
						{s.via && (
							<div className="ml-12 mb-4 flex items-start gap-2 rounded-xl border border-[#4ade80]/20 bg-[#4ade80]/5 px-3 py-2">
								{s.via.icon === "route" ? (
									<CornerDownRight className="w-3.5 h-3.5 text-[#86efac] mt-0.5 shrink-0" />
								) : (
									<BrainCircuit className="w-3.5 h-3.5 text-[#86efac] mt-0.5 shrink-0" />
								)}
								<p className="text-[12px] text-white/55 leading-relaxed">{s.via.text}</p>
							</div>
						)}

						{/* Brain answer */}
						<div className="flex gap-3">
							<div className="w-9 h-9 rounded-xl bg-white/10 ring-1 ring-[#4ade80]/30 flex items-center justify-center overflow-hidden shrink-0">
								<img src="/logo_real.png" alt="Context Window" className="w-full h-full object-cover" />
							</div>
							<div className="min-w-0">
								<div className="flex items-baseline gap-2">
									<span className="text-sm font-semibold text-white">Context Window</span>
									<span className="text-[10px] font-semibold tracking-wider uppercase bg-[#4ade80]/15 text-[#86efac] px-1.5 py-0.5 rounded">App</span>
								</div>
								<p className="text-sm text-white/85 mt-1 leading-relaxed">{s.answer}</p>
								<div className="flex flex-wrap items-center gap-2 mt-3">
									<span className="text-[11px] text-white/40">Sources</span>
									{s.sources.map((src) => (
										<span key={src} className="text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
											{src}
										</span>
									))}
								</div>
								{s.learned && (
									<div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#4ade80]/15 text-[#86efac] text-[11px] font-medium px-2.5 py-1">
										<Sparkles className="w-3 h-3" />
										{s.learned}
									</div>
								)}
							</div>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Pager dots */}
			<div className="flex items-center justify-center gap-2 mt-4">
				{SCENES.map((sc, idx) => (
					<button
						key={sc.name}
						onClick={() => setI(idx)}
						aria-label={`Show example ${idx + 1}`}
						className={`h-1.5 rounded-full transition-all duration-300 ${
							idx === i ? "w-6 bg-[#4ade80]" : "w-1.5 bg-white/25 hover:bg-white/45"
						}`}
					/>
				))}
			</div>
		</div>
	)
}
