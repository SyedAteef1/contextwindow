// The gated, logged-in home. Server component: reads the session, enforces the approval gate.
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { BrainSearch } from "@/components/brain-search";
import { CanvasDots } from "@/components/ui/canvas-dots";
import { getIdentityByPrincipal } from "@/lib/auth/approval";
import { getSessionPrincipal } from "@/lib/auth/session";

const HOW_TO = [
  {
    icon: "🔌",
    title: "1. Connect your tools",
    body: "Open Integrations and link Slack, GitHub, Notion and Drive. The brain reads from them so answers come from your real, current docs — not guesses.",
  },
  {
    icon: "🔎",
    title: "2. Ask in plain English",
    body: "Use Ask for a written answer with sources, or Search for the raw matching memories. Be specific (\"what's our refund threshold?\") — the brain answers only from what it knows and cites where it came from.",
  },
  {
    icon: "🎭",
    title: "3. Pick the right voice",
    body: "Switch the role (Engineer, Executive, Support, Sales, Onboarding) to reshape the same answer for your audience — terse for execs, step-by-step for engineers.",
  },
  {
    icon: "🙋",
    title: "4. It asks once, then knows forever",
    body: "If the brain doesn't know, it routes your question to the right owner in Slack. Once they reply, it captures the answer — so the next person gets it instantly.",
  },
];

export default async function AppPage() {
  const principal = await getSessionPrincipal();
  if (!principal) redirect("/login");
  const id = await getIdentityByPrincipal(principal);
  if (!id) redirect("/login");
  if (id.status !== "approved") redirect("/pending");

  return (
    <main className="relative min-h-screen w-full text-white font-sans overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1f14 0%, #050a07 55%, #000 100%)" }}>
      <CanvasDots />
      <AppNav active="home" />
      <div className="relative z-10 pt-28 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-medium tracking-tight">Welcome, {id.displayName ?? id.email} 👋</h1>
        <p className="text-sm text-white/55 mt-2">Ask your company brain anything — it answers from your team&apos;s real knowledge, with sources.</p>

        {/* Search / ask the brain */}
        <div className="mt-8">
          <BrainSearch />
        </div>

        {/* Integrations entry */}
        <a href="/integrations" className="liquid-glass rounded-3xl p-6 mt-6 flex items-center gap-4 hover:scale-[1.01] transition-transform block">
          <div className="text-2xl">🔌</div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Integrations</h2>
            <p className="text-sm text-white/55">Connect Slack, GitHub, Notion, Drive and more so the brain learns from them.</p>
          </div>
          <span className="text-white/40 text-xl">→</span>
        </a>

        {/* How to use it effectively */}
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-5">How to use it effectively</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HOW_TO.map((step) => (
              <div key={step.title} className="liquid-glass rounded-2xl p-5">
                <div className="text-xl mb-2">{step.icon}</div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[11px] text-white/30 mt-12">signed in as {id.email} · {id.principalId}</p>
      </div>
    </main>
  );
}
