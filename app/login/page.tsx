// Sign-in page. Google is the real path; the dev link only renders in development.

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export default function LoginPage() {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-6 text-white font-sans"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #0a1f14 0%, #050a07 55%, #000 100%)" }}>
      <div className="liquid-glass-strong rounded-3xl p-10 w-full max-w-sm text-center border border-white/10">
        <div className="w-12 h-12 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-[#4ade80] text-xl">🧠</span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">Sign in to Context Window</h1>
        <p className="text-sm text-white/55 mt-2 mb-8">Use your company Google account.</p>

        <a href="/api/auth/google"
          className="flex items-center justify-center gap-3 bg-white text-black font-semibold rounded-full py-3 hover:bg-white/90 transition">
          <GoogleIcon /> Sign in with Google
        </a>

        {isDev && (
          <div className="mt-6 pt-6 border-t border-white/10 text-left">
            <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Dev test login</p>
            <div className="flex flex-col gap-2 text-sm">
              <a className="text-[#86efac] hover:underline" href="/api/auth/dev?email=you@contravault.com">→ you@contravault.com (auto-approved domain)</a>
              <a className="text-[#86efac] hover:underline" href="/api/auth/dev?email=outsider@gmail.com">→ outsider@gmail.com (needs Slack approval)</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
