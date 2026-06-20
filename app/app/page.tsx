// The gated, logged-in home. Server component: reads the session, enforces the approval gate.
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getIdentityByPrincipal } from "@/lib/auth/approval";
import { getSessionPrincipal } from "@/lib/auth/session";

export default async function AppPage() {
  const principal = await getSessionPrincipal();
  if (!principal) redirect("/login");
  const id = await getIdentityByPrincipal(principal);
  if (!id) redirect("/login");
  if (id.status !== "approved") redirect("/pending");

  return (
    <main className="relative min-h-screen w-full text-white font-sans"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1f14 0%, #050a07 55%, #000 100%)" }}>
      <AppNav active="home" />
      <div className="pt-28 px-6 max-w-3xl mx-auto">
        <h1 className="text-3xl font-medium tracking-tight">Welcome, {id.displayName ?? id.email} 👋</h1>
        <p className="text-sm text-white/55 mt-2">You&apos;re approved and signed in to the Context Window brain.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-10">
          <a href="/integrations" className="liquid-glass rounded-3xl p-7 hover:scale-[1.02] transition-transform block">
            <div className="text-2xl mb-3">🔌</div>
            <h2 className="text-lg font-semibold">Integrations</h2>
            <p className="text-sm text-white/55 mt-1">Connect Slack, GitHub, Notion, Drive and more so the brain learns from them.</p>
          </a>
          <div className="liquid-glass rounded-3xl p-7 opacity-70">
            <div className="text-2xl mb-3">💬</div>
            <h2 className="text-lg font-semibold">Ask the brain <span className="text-[11px] text-white/40">(soon)</span></h2>
            <p className="text-sm text-white/55 mt-1">A chat surface to ask the company brain anything, with sources.</p>
          </div>
        </div>

        <p className="text-[11px] text-white/30 mt-10">signed in as {id.email} · {id.principalId}</p>
      </div>
    </main>
  );
}
