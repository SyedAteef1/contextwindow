// The gated, logged-in area. Server component: reads the session, enforces the approval gate.
import { redirect } from "next/navigation";
import { getIdentityByPrincipal } from "@/lib/auth/approval";
import { getSessionPrincipal } from "@/lib/auth/session";

export default async function AppPage() {
  const principal = await getSessionPrincipal();
  if (!principal) redirect("/login");
  const id = await getIdentityByPrincipal(principal);
  if (!id) redirect("/login");
  if (id.status !== "approved") redirect("/pending");

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-white font-sans"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1f14 0%, #050a07 55%, #000 100%)" }}>
      <div className="liquid-glass-strong rounded-3xl p-10 w-full max-w-lg text-center border border-[#4ade80]/30">
        <div className="w-12 h-12 rounded-full bg-[#4ade80]/15 flex items-center justify-center mx-auto mb-6">
          <span className="text-[#4ade80] text-xl">✅</span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">Welcome, {id.displayName ?? id.email}</h1>
        <p className="text-sm text-white/60 mt-3">You&apos;re approved and signed in to the Context Window brain.</p>
        <p className="text-[11px] text-white/35 mt-6">principal: {id.principalId} · {id.email}</p>
      </div>
    </main>
  );
}
