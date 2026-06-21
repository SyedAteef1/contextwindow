// Shown to a logged-in but not-yet-approved user.
import { CanvasDots } from "@/components/ui/canvas-dots";

export default function PendingPage() {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-white font-sans overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1f14 0%, #050a07 55%, #000 100%)" }}>
      <CanvasDots />
      <div className="relative z-10 liquid-glass-strong rounded-3xl p-10 w-full max-w-md text-center border border-white/10">
        <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-amber-300 text-xl">⏳</span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">Awaiting approval</h1>
        <p className="text-sm text-white/60 mt-3 leading-relaxed">
          Your request has been sent to the team for approval. You&apos;ll get access as soon as an admin approves you in Slack — no need to do anything else.
        </p>
      </div>
    </main>
  );
}
