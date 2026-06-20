// Top nav for the logged-in app area (Home / Integrations / Sign out).

export function AppNav({ active }: { active: "home" | "integrations" }) {
  const link = (href: string, label: string, key: string) => (
    <a
      href={href}
      className={`text-sm font-medium transition-colors ${active === key ? "text-white" : "text-white/55 hover:text-white"}`}
    >
      {label}
    </a>
  );
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-black/70 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-6">
        <a href="/app" className="flex items-center gap-2 font-serif font-medium text-white">
          <span className="text-[#4ade80]">🧠</span> Context Window
        </a>
        {link("/app", "Home", "home")}
        {link("/integrations", "Integrations", "integrations")}
      </div>
      <a href="/api/auth/logout" className="text-sm text-white/55 hover:text-white transition-colors">
        Sign out
      </a>
    </header>
  );
}
