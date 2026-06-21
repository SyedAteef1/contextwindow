"use client";

/* eslint-disable react/no-unescaped-entities -- marketing copy contains apostrophes/quotes by design */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Calendar, Code2, Menu, X, Network, MessageSquareText, Bell, ShieldCheck, Check, Rocket, TrendingUp, LifeBuoy, Layers, Megaphone, Users, Lock, KeyRound, FileCheck2, EyeOff } from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { ConnectorMarquee } from "@/components/connector-marquee";
import { SalesDemo } from "@/components/sales-demo";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ y: 40, opacity: 0, filter: "blur(8px)" }}
    whileInView={{ y: 0, opacity: 1, filter: "blur(0px)" }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} className="relative overflow-hidden group h-8 block font-serif text-base font-medium text-white/70 hover:text-white transition-colors">
    <div className="flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] -translate-y-8 group-hover:translate-y-0">
      <span className="h-8 flex items-center">{children}</span>
      <span className="h-8 flex items-center">{children}</span>
    </div>
  </a>
);

const founders = [
  {
    name: "Syed Ateef",
    title: "Founder & Builder",
    bio: "Syed is the Founder and Builder of Context Window. High-agency shipper hacking multi-agent orchestration, local LLM pipelines, and memory-graph architecture.",
    image: "/ateef_photo.png",
    twitter: "https://x.com/syedateef_",
    linkedin: "https://www.linkedin.com/in/syed-ateef-quadri-v-4a55ab318/"
  }
];

const FounderCard = ({ founder }: { founder: typeof founders[0] }) => {
  return (
    <motion.div 
      className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden group bg-black"
      initial="initial"
      whileHover="hover"
      animate="initial"
    >
      {/* Duotone Image Effect */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#00ff66] mix-blend-multiply z-10 opacity-70 transition-opacity group-hover:opacity-90" />
        <div className="absolute inset-0 bg-[#001a0d] mix-blend-screen z-10 opacity-40" />
        <img 
          src={founder.image} 
          alt={founder.name}
          className="w-full h-full object-cover grayscale contrast-150 brightness-90 group-hover:scale-105 transition-transform duration-700"
        />
      </div>

      {/* Info Tab */}
      <motion.div 
        layout
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-0 left-0 w-[85%] bg-[#f4f4f0] text-black rounded-tr-[2.5rem] overflow-hidden flex flex-col justify-end z-20 origin-bottom"
      >
        <div className="p-6 pt-5">
          <motion.div
            variants={{
              initial: { opacity: 0, height: 0, marginBottom: 0 },
              hover: { opacity: 1, height: "auto", marginBottom: 16 }
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-gray-800 leading-relaxed font-medium mb-4">
              {founder.bio}
            </p>
            <div className="flex gap-2">
              <a href={founder.twitter} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                <TwitterIcon className="w-4 h-4 fill-current" />
              </a>
              <a href={founder.linkedin} target="_blank" rel="noopener noreferrer" className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                <LinkedinIcon className="w-4 h-4 fill-current" />
              </a>
            </div>
          </motion.div>

          <motion.div layout className="mt-auto">
            <h3 className="text-xl font-bold font-serif tracking-tight text-gray-900">{founder.name}</h3>
            <p className="text-sm text-gray-500 font-medium">{founder.title}</p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  const handleDemoCta = (location: string) => {
    posthog.capture("demo_cta_clicked", { location });
    router.push("/apply");
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white font-sans selection:bg-white/20">
      {/* Background Video */}
      <div className="fixed inset-0 w-full h-full z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Navigation Bar */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 px-6 lg:px-16 grid grid-cols-2 md:grid-cols-3 items-center transition-all duration-300 ${
          scrolled
            ? "py-2 lg:py-2.5 bg-black/80 backdrop-blur-md border-b border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.4)]"
            : "py-4 lg:py-6 bg-gradient-to-b from-black/70 to-transparent border-b border-transparent"
        }`}
      >
        {/* Left Side: Logo */}
        <div className="flex items-center gap-3 justify-self-start">
           <div className="w-8 h-8 rounded-md flex items-center justify-center overflow-hidden">
             <img src="/logo_real.png" alt="Context Window Logo" className="w-full h-full object-cover" />
           </div>
           <span className="font-serif font-medium text-lg sm:text-xl tracking-tight hidden sm:block">Context Window</span>
        </div>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center justify-center gap-8 justify-self-center">
          <NavLink href="#about">Product</NavLink>
          <NavLink href="#how">How it Works</NavLink>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#pricing">Pricing</NavLink>
        </nav>

        {/* Right Side: Menu Button and Apply Button */}
        <div className="flex items-center gap-6 justify-self-end">
          <div className="hidden md:block">
            <LiquidMetalButton label="Book a Demo" onClick={() => handleDemoCta("nav")} />
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden liquid-glass flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition-transform active:scale-95"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
        </div>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-md pt-32 px-8 flex flex-col gap-8 md:hidden"
          >
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">Product</a>
            <a href="#how" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">How it Works</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">Features</a>
            <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">Pricing</a>
            <div className="mt-8">
              <LiquidMetalButton label="Book a Demo" onClick={() => { setIsMobileMenuOpen(false); handleDemoCta("nav_mobile"); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Overlay */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24 space-y-20 sm:space-y-28">
        
        {/* Section 1: The Hero */}
        <section className="min-h-[72vh] flex flex-col justify-center items-center text-center pt-16">
          <FadeIn delay={0.1} className="w-full flex justify-center">
            <div className="liquid-glass rounded-full px-4 py-1.5 mb-8 flex items-center gap-2 max-w-[90vw]">
              <span className="text-[9px] sm:text-xs font-semibold tracking-widest text-white/80 truncate">THE COMPANY BRAIN • NOW IN PRIVATE BETA</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.2} className="w-full">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-medium tracking-tighter leading-[1.05] mb-8 mx-auto max-w-5xl px-2">
              The invisible brain for your <em className="font-serif italic font-normal text-white/90">whole company.</em>
            </h1>
          </FadeIn>

          <FadeIn delay={0.3} className="w-full">
            <p className="text-base sm:text-lg lg:text-xl text-white/60 mx-auto max-w-2xl mb-12 font-medium px-2">
              It quietly follows your team&apos;s every move and turns the chaos into clarity — so you stay ahead, without chasing a single update.
            </p>
          </FadeIn>

          <FadeIn delay={0.4} className="w-full">
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
              <LiquidMetalButton label="Book a Demo" onClick={() => handleDemoCta("hero")} />
              <a href="#pricing" className="text-sm text-white/70 hover:text-white font-medium flex items-center gap-2 transition-colors">
                See Pricing
              </a>
            </div>
          </FadeIn>
        </section>

        {/* Section: Connectors marquee */}
        <FadeIn>
          <section className="space-y-8 -mt-8 sm:-mt-16">
            <p className="text-center text-xs sm:text-sm uppercase tracking-[0.2em] text-white/40 font-semibold">
              Plugs into the tools your team already lives in
            </p>
            <ConnectorMarquee />
          </section>
        </FadeIn>

        {/* Section: Product preview — see it answer */}
        <FadeIn>
          <section className="space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">See it in action</h2>
              <p className="text-lg text-white/70 mt-4">
                Your team just asks in Slack. When the brain isn't sure, it quietly asks the right engineer, then remembers the answer so no one is interrupted twice.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {/* Slack answer mock — rotates through scenarios */}
              <SalesDemo />

              {/* Today briefing mock */}
              <div className="lg:col-span-2 liquid-glass rounded-3xl p-6 sm:p-8 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-4 h-4 text-white/70" />
                  <span className="text-xs font-semibold tracking-widest uppercase text-white/50">Today · 8:00 AM</span>
                </div>
                <h3 className="text-lg font-semibold mb-4">Your morning briefing</h3>
                <ul className="space-y-4 text-sm text-white/75 flex-1">
                  <li className="flex gap-3">
                    <span className="text-emerald-400 mt-0.5">▲</span>
                    <span><span className="text-white font-medium">Acme renewal</span> moved to legal, closing this week.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-amber-400 mt-0.5">●</span>
                    <span><span className="text-white font-medium">Onboarding bug</span> raised by 3 customers in #support overnight.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-sky-400 mt-0.5">◆</span>
                    <span><span className="text-white font-medium">Hiring:</span> 2 senior eng candidates reached final round.</span>
                  </li>
                </ul>
                <p className="text-[11px] text-white/40 mt-5 pt-4 border-t border-white/10">Delivered to founders every morning. No dashboards to check.</p>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Section: Founding partners / momentum */}
        <FadeIn>
          <section className="relative liquid-glass-strong rounded-[2.5rem] overflow-hidden p-8 sm:p-12 lg:p-16 border border-[#4ade80]/20 shadow-2xl">
            <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
              <div className="flex items-center gap-2 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
                </span>
                <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-[#86efac]">
                  Private Beta · Founding Partners
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight leading-tight mb-5">
                Built with our first teams, not for a faceless market
              </h2>
              <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mb-8">
                We're live in private beta with a small group of design partners, and the waitlist is filling with teams who want a brain for their company. Founding partners help shape the roadmap and lock in launch pricing before we open the doors.
              </p>

              <div className="flex flex-wrap justify-center gap-2.5 mb-10">
                {[
                  "Design partners onboarding now",
                  "Waitlist open",
                  "Roadmap shaped by founding teams",
                ].map((chip) => (
                  <span key={chip} className="liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium text-white/80">
                    {chip}
                  </span>
                ))}
              </div>

              <LiquidMetalButton label="Request Founding Access" onClick={() => handleDemoCta("founding_access")} />
              <p className="text-xs text-white/40 mt-4">Limited spots while we onboard each team properly.</p>
            </div>
          </section>
        </FadeIn>

        {/* Section 1.5: About */}
        <FadeIn>
          <section id="about" className="text-center space-y-4 max-w-4xl mx-auto pt-4 sm:pt-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight px-4 sm:px-0">One brain for everything your team knows</h2>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed text-center px-6 sm:px-0">
              Knowledge in a company is scattered across Slack threads, docs, tickets, and people's heads, and it goes stale the moment it's written down. Context Window continuously reads from every tool, distills it into a living memory that versions itself and forgets what's outdated, and surfaces what matters, with its sources, the moment you need it. No new app to adopt, no dashboards to babysit. Just a brain that stays current.
            </p>
          </section>
        </FadeIn>


        {/* Section 3: How it Works */}
        <section id="how" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">How it Works</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mt-4">
                Connect once. The brain collects, remembers, and serves answers back into the tools you already live in.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FadeIn delay={0.1}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <Network className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">1. Collects from every tool</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  One-click connectors for Slack, Claude/MCP, your CRM, email, Drive and more. Context Window reads what's happening in the background, secrets redacted, so nothing has to be copied or re-entered.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">2. Remembers what matters</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Raw chatter becomes durable, versioned memory. When a fact changes, the brain supersedes the old one; when it goes stale, it forgets. That's the moat: knowledge that stays true, not a pile of old messages.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <MessageSquareText className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">3. Answers & briefs you</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Ask in Slack (@mention, DM, or <span className="font-mono text-white/80">/ask</span>) and get a grounded answer with sources. Every morning it pushes a proactive "today" briefing so founders see what's moving across the team.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section: How it's different */}
        <section id="why" className="space-y-12">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Not another tool to learn</h2>
              <p className="text-sm text-white/60 mt-4 max-w-xl mx-auto leading-relaxed">
                Most tools hand you a dashboard and walk away. Context Window feels like <span className="text-[#86efac] font-medium">your own brain</span> — living where your team already works, thinking alongside you from day one. You just connect it, and it gets you.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* The hard way */}
            <FadeIn delay={0.1} className="h-full">
              <div className="liquid-glass rounded-3xl p-8 h-full">
                <div className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-6">Other tools</div>
                <ul className="space-y-4">
                  {[
                    "Weeks of setup, configuration and admin",
                    "Yet another dashboard you have to remember to check",
                    "You only find it if you already know what to search for",
                    "Steep learning curve that needs team training",
                    "Passive: it just sits there until someone digs",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/55">
                      <span className="mt-0.5 shrink-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
                        <X className="w-2.5 h-2.5 text-white/35" strokeWidth={3} />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            {/* The Context Window way */}
            <FadeIn delay={0.2} className="h-full">
              <div className="liquid-glass-strong rounded-3xl p-8 h-full border border-[#4ade80]/25">
                <div className="text-[#86efac] text-sm font-semibold tracking-widest uppercase mb-6 flex items-center gap-2">
                  <img src="/logo_real.png" alt="Context Window" className="w-5 h-5 rounded object-cover shrink-0" /> Context Window
                </div>
                <ul className="space-y-4">
                  {[
                    "Live in minutes: connect Slack and you're done",
                    "No new app: it guides and alerts you right in Slack",
                    "It surfaces what matters before you even ask",
                    "Zero learning curve: if you can chat, you can use it",
                    "Proactive: it briefs you and flags what needs you",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-white/90">
                      <span className="mt-0.5 shrink-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#4ade80]/12 ring-1 ring-[#4ade80]/30">
                        <Check className="w-2.5 h-2.5 text-[#4ade80]" strokeWidth={3} />
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.3}>
            <p className="text-center text-sm text-white/40 max-w-2xl mx-auto">
              Powerful underneath, effortless on top. Your team just feels a brain that has their back.
            </p>
          </FadeIn>
        </section>

        {/* Section: Features by team */}
        <section id="features" className="space-y-12">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">What it does for every team</h2>
              <p className="text-lg text-white/70 mt-4">
                One brain, tailored to whoever's asking. Role-scoped, permission-aware, and always sourced, so each team gets exactly what it needs in the tools they already use.
              </p>
            </div>
          </FadeIn>

          {/* The engine — core capabilities as chips */}
          <FadeIn>
            <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
              {[
                "Lifetime institutional memory",
                "Stays current, never stale",
                "Learns from every escalation",
                "Code-aware",
                "Sources on every answer",
                "Role & permission aware",
                "Proactive briefings & alerts",
                "Research agent",
              ].map((cap) => (
                <span key={cap} className="liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium text-white/75">
                  {cap}
                </span>
              ))}
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Rocket,
                role: "Founders / CEO",
                points: [
                  "A morning briefing: what moved, what's at risk, what needs you",
                  "Instant recall of past decisions and the context behind them",
                  "Role-scoped research across internal data and the web",
                ],
              },
              {
                icon: Code2,
                role: "CTO / Engineering",
                points: [
                  "Architecture and design help grounded in your real stack",
                  "Code-aware answers: what's shipped, in review, and who owns what",
                  "Faster onboarding plus auto-drafted release notes",
                ],
              },
              {
                icon: TrendingUp,
                role: "Sales",
                points: [
                  "Demo guidance on what's live versus still in development",
                  "The right pricing, deck, or one-pager on demand",
                  "Follow-up drafts, battlecards, and deal memory",
                ],
              },
              {
                icon: LifeBuoy,
                role: "Customer Success",
                points: [
                  "Real feature ETAs from engineering, remembered for everyone",
                  "Answers tickets from past resolutions, routes the hard ones",
                  "Flags churn risk and preps QBRs with full account history",
                ],
              },
              {
                icon: Layers,
                role: "Product / PM",
                points: [
                  "Aggregates feature requests from Slack, tickets, and calls",
                  "\"What did customers say about X?\" with quotes and sources",
                  "Keeps a living decision log and roadmap status",
                ],
              },
              {
                icon: Megaphone,
                role: "Marketing",
                points: [
                  "Ongoing competitive analysis, refreshed as things change",
                  "Consistent messaging and repurposed past content",
                  "Coordinates launches so nothing is missed",
                ],
              },
              {
                icon: Users,
                role: "People / HR & Ops",
                points: [
                  "Instant onboarding answers: where's the doc, who owns this",
                  "Flags slipping start dates, overdue tasks, and bottlenecks",
                  "Retains a person's context when they leave",
                ],
              },
              {
                icon: Calendar,
                role: "Across everyone",
                points: [
                  "Reads inboxes, surfaces what matters, drafts replies for approval",
                  "Creates calendar reminders and nudges before deadlines",
                  "Points out delays and blockers proactively",
                ],
              },
            ].map((team, i) => {
              const Icon = team.icon;
              return (
                <FadeIn key={team.role} delay={0.05 * (i % 3)} className="h-full">
                  <div className="liquid-glass rounded-3xl p-7 h-full flex flex-col hover:scale-[1.02] transition-transform">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-base font-semibold">{team.role}</h3>
                    </div>
                    <ul className="space-y-3 flex-1">
                      {team.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-sm text-white/65 leading-relaxed">
                          <span className="mt-0.5 shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#4ade80]/12 ring-1 ring-[#4ade80]/25">
                            <Check className="w-2.5 h-2.5 text-[#4ade80]" strokeWidth={3} />
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          <FadeIn delay={0.2}>
            <p className="text-center text-sm text-white/40 max-w-2xl mx-auto">
              And it keeps expanding: meeting notes, standup summaries, board prep, hiring status, vendor and contract memory, incident response, pre-meeting briefs, and scheduled research reports.
            </p>
          </FadeIn>
        </section>

        {/* Section: Connecting the Dots */}
        <FadeIn>
          <section className="relative liquid-glass-strong rounded-[2.5rem] overflow-hidden min-h-[40vh] flex items-center justify-center p-8 lg:p-16 border border-white/5 shadow-2xl">
            <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-medium tracking-tight leading-tight mb-8 text-white">
                "You can't connect the dots looking forward; you can only connect them looking backwards."
              </h2>
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20">
                  <img src="/steve_jobs.jpg" alt="Steve Jobs" className="w-full h-full object-cover grayscale" />
                </div>
                <span className="font-serif italic text-white/80 text-lg sm:text-xl">~ Steve Jobs</span>
              </div>

              <div className="w-16 h-[1px] bg-white/20 mb-10" />

              <p className="text-base sm:text-lg lg:text-xl text-white/90 font-medium leading-relaxed max-w-2xl mx-auto">
                Every decision your team makes is a dot. Context Window is the memory that connects them, so the context behind today's work is never lost, and your company gets smarter the longer it runs.
              </p>
            </div>
          </section>
        </FadeIn>

        {/* New Section: The Founders */}
        <section className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Built by Engineers.</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mt-4">
                Made by people who've felt the pain of knowledge scattered across a dozen tools.
              </p>
            </div>
          </FadeIn>
          
          <div className="grid grid-cols-1 w-full max-w-sm mx-auto">
            {founders.map((founder, i) => (
              <FadeIn key={founder.name} delay={i * 0.1} className="w-full">
                <FounderCard founder={founder} />
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Section: Pricing */}
        <section id="pricing" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Simple, Team-Based Pricing</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mt-4">
                Start with one Slack workspace. Scale to your whole company. Cancel anytime.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {[
              {
                name: "Starter", price: "$499", per: "/month", popular: false,
                tagline: "For a single team finding its feet.",
                cta: "Start Free Trial",
                features: ["Up to 25 members", "Slack + 2 connectors", "Living memory graph", "/ask answers with sources", "Email support"],
              },
              {
                name: "Growth", price: "$1,499", per: "/month", popular: true,
                tagline: "For founders who want the full picture.",
                cta: "Book a Demo",
                features: ["Up to 100 members", "All connectors", "Proactive daily “today” briefings", "MCP access (Claude, Cursor)", "Audit log & permissions", "Priority support"],
              },
              {
                name: "Enterprise", price: "Custom", per: "", popular: false,
                tagline: "Your data, your cloud, your rules.",
                cta: "Talk to Sales",
                features: ["Unlimited members", "Deploy in your own AWS (pgvector)", "SSO / SAML", "Custom skills & workflows", "Dedicated support & SLA", "Security review & DPA"],
              },
            ].map((plan, i) => (
              <FadeIn key={plan.name} delay={0.1 * (i + 1)} className="h-full">
                <div className={`rounded-3xl p-8 h-full flex flex-col ${plan.popular ? "liquid-glass-strong border border-[#4ade80]/40 shadow-[0_0_40px_rgba(74,222,128,0.08)]" : "liquid-glass"}`}>
                  {/* in-flow badge slot — keeps all three plans aligned */}
                  <div className="h-7 mb-4 flex items-center justify-center">
                    {plan.popular && (
                      <span className="bg-[#4ade80] text-black text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-6 flex-1">
                    <div>
                      <div className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-3">{plan.name}</div>
                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-4xl font-medium tracking-tight">{plan.price}</span>
                        {plan.per && <span className="text-white/50 text-sm font-medium mb-1.5">{plan.per}</span>}
                      </div>
                      <p className="text-sm text-white/60">{plan.tagline}</p>
                    </div>
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className={`flex items-start gap-3 text-sm ${plan.popular ? "text-white/90" : "text-white/80"}`}>
                          <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.popular ? "text-[#4ade80]" : "text-white/70"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <LiquidMetalButton label={plan.cta} onClick={() => handleDemoCta(`pricing_${plan.name.toLowerCase()}`)} />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4}>
            <p className="text-center text-sm text-white/40 max-w-2xl mx-auto">
              All plans include redaction of secrets at ingest, provenance on every answer, and memory that versions and forgets to stay current. 14-day free trial, no credit card required.
            </p>
          </FadeIn>
        </section>

        {/* Section 5: Why teams trust it */}
        <section id="trust" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Built for Teams That Move Fast.</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FadeIn delay={0.1} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Calendar className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Setup</span>
                <strong className="text-base font-medium">Live in Minutes</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.2} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <ShieldCheck className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Privacy</span>
                <strong className="text-base font-medium">Your Data, Your Cloud</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.3} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Bell className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Proactive</span>
                <strong className="text-base font-medium">Daily “Today” Briefings</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.4} className="h-full">
              <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Code2 className="w-8 h-8 text-white mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/70 mb-1 font-semibold">The Difference</span>
                <strong className="text-base font-medium">Memory That Stays Current</strong>
                <p className="text-xs text-white/60 mt-2">It versions facts when they change and forgets what's stale. Every answer ships with its sources.</p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section: Data safety / compliance */}
        <section id="security" className="space-y-10">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#4ade80]/10 ring-1 ring-[#4ade80]/20 px-4 py-1.5 mb-5">
                <ShieldCheck className="w-4 h-4 text-[#4ade80]" />
                <span className="text-xs font-semibold tracking-wide text-[#86efac] uppercase">Security &amp; Privacy</span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Your data is yours. Full stop.</h2>
              <p className="text-sm text-white/60 mt-4 leading-relaxed">
                We guard your company&apos;s knowledge like it&apos;s our own. It&apos;s never sold, never used to train models, and never leaves your control.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Server, title: "Runs in your own cloud", body: "Deploy fully inside your AWS, on your own Postgres + pgvector. Nothing ever leaves your infrastructure." },
              { icon: Lock, title: "Secrets stripped at ingest", body: "Tokens, keys and secrets are redacted before anything is stored. We never keep what we shouldn't." },
              { icon: Users, title: "Scoped to each person", body: "Everyone only sees what they're allowed to. The brain never answers beyond someone's permissions." },
              { icon: FileCheck2, title: "Audited & sourced", body: "Every answer carries its sources and every action is logged. You can verify anything in one click." },
              { icon: KeyRound, title: "SSO, SAML & DPA", body: "Enterprise SSO, SAML and a signed DPA — built to sail through your security review." },
              { icon: EyeOff, title: "Never trained on, never sold", body: "Your knowledge is never used to train models and never shared with anyone. It stays yours, period." },
            ].map((c, i) => (
              <FadeIn key={c.title} delay={0.05 * i} className="h-full">
                <div className="liquid-glass rounded-3xl p-6 h-full">
                  <div className="w-10 h-10 rounded-2xl bg-[#4ade80]/10 ring-1 ring-[#4ade80]/20 flex items-center justify-center mb-4">
                    <c.icon className="w-5 h-5 text-[#4ade80]" />
                  </div>
                  <h3 className="text-base font-semibold">{c.title}</h3>
                  <p className="text-sm text-white/55 mt-1.5 leading-relaxed">{c.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Section: FAQ */}
        <section id="faq" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Questions buyers always ask</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[
              {
                q: "Where does our data live?",
                a: "Your call. Use our managed cloud, or deploy entirely inside your own AWS account on your own Postgres + pgvector, so nothing leaves your infrastructure. Enterprise plans run fully in your VPC.",
              },
              {
                q: "Is it secure? What about secrets?",
                a: "Secrets and tokens are redacted at ingest before anything is stored. Access is scoped per person, every action is written to an audit log, and the bot only answers people who are allowed to see the underlying source.",
              },
              {
                q: "How long does setup take?",
                a: "Minutes. Connect Slack with one OAuth click, invite the bot to a few channels, and it starts building memory immediately. No data migration, no schema work, no rip-and-replace.",
              },
              {
                q: "How do we trust the answers?",
                a: "Every answer ships with its sources, so anyone can verify in one click. When a fact changes, the brain supersedes the old version; when it goes stale, it forgets, so you're never quoted yesterday's truth.",
              },
              {
                q: "Will it spam our channels?",
                a: "No. It's answer-only: it replies only when @mentioned, sent a DM, or asked via /ask. The one proactive touch is the optional morning briefing, sent privately to whoever opts in.",
              },
              {
                q: "What does it run on?",
                a: "A living memory graph with hybrid vector + keyword retrieval, exposed over MCP so it works in Claude, Cursor, and any MCP client, not just Slack.",
              },
            ].map((item) => (
              <FadeIn key={item.q}>
                <div className="liquid-glass rounded-3xl p-7 h-full">
                  <h3 className="text-base font-semibold mb-2.5 flex items-start gap-2">
                    <span className="text-white/40">Q.</span>
                    <span>{item.q}</span>
                  </h3>
                  <p className="text-sm text-white/65 leading-relaxed pl-6">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Section 6: Footer & Final CTA */}
        <FadeIn>
          <footer className="pt-20 pb-12 flex flex-col items-center text-center border-t border-white/10">
            <h2 className="text-4xl lg:text-6xl font-medium tracking-tight mb-6 max-w-4xl">
              Give your company a <em className="font-serif italic font-normal text-white/80">brain.</em>
            </h2>
            <p className="text-lg text-white/60 mb-10 font-medium">
              See it read your Slack and answer your team's hardest questions in a 20-minute demo.
            </p>
            <LiquidMetalButton label="Book a Demo" onClick={() => handleDemoCta("footer")} />

            <div className="mt-24 text-white/40 text-sm font-medium">
              © 2026 Context Window. All rights reserved.
            </div>
          </footer>
        </FadeIn>

      </div>
    </main>
  );
}
