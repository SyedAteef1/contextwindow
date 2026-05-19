"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, CreditCard, Users, ArrowRight, CheckCircle2, ChevronRight, MapPin, Calendar, Users2, Code2, Menu, X } from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";

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
    bio: "Syed is the Founder and Builder of Context Window HQ. High-agency shipper hacking multi-agent orchestration, local LLM pipelines, and deep-tech architecture.",
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
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 lg:px-16 lg:py-6 grid grid-cols-2 md:grid-cols-3 items-center bg-gradient-to-b from-black/80 to-transparent"
      >
        {/* Left Side: Logo */}
        <div className="flex items-center gap-3 justify-self-start">
           <div className="w-8 h-8 rounded-md flex items-center justify-center overflow-hidden">
             <img src="/logo_real.png" alt="Context Window HQ Logo" className="w-full h-full object-cover" />
           </div>
           <span className="font-retro text-[10px] sm:text-xs leading-tight mt-1 tracking-tight hidden lg:block">Context Window HQ</span>
        </div>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center justify-center gap-8 justify-self-center">
          <NavLink href="#about">About</NavLink>
          <NavLink href="#events">Events</NavLink>
          <NavLink href="#sprint">The Sprint</NavLink>
        </nav>

        {/* Right Side: Menu Button and Apply Button */}
        <div className="flex items-center gap-6 justify-self-end">
          <div className="hidden md:block">
            <LiquidMetalButton label="Apply Now" />
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
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">About</a>
            <a href="#events" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">Events</a>
            <a href="#sprint" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-serif text-white/80 hover:text-white transition-colors">The Sprint</a>
            <div className="mt-8">
              <LiquidMetalButton label="Apply Now" onClick={() => setIsMobileMenuOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Overlay */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24 space-y-32">
        
        {/* Section 1: The Hero */}
        <section className="min-h-[85vh] flex flex-col justify-center items-center text-center pt-20">
          <FadeIn delay={0.1}>
            <div className="liquid-glass rounded-full px-4 py-1.5 mb-8 flex items-center gap-2 max-w-[90vw]">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-white/70 shrink-0" />
              <span className="text-[9px] sm:text-xs font-semibold tracking-widest text-white/80 truncate">BENGALURU, INDIA • COHORT ZERO OPEN</span>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2}>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-medium tracking-tighter leading-[1.05] mb-8 max-w-5xl">
              Expanding the context window for India's best <em className="font-serif italic font-normal text-white/90">builders.</em>
            </h1>
          </FadeIn>
          
          <FadeIn delay={0.3}>
            <p className="text-lg lg:text-xl text-white/60 max-w-3xl mb-12 font-medium">
              A zero-friction, high-density hacker house for the top 1% of engineers orchestrating multi-agent systems, local LLMs, and deep-tech infrastructure.
            </p>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <LiquidMetalButton label="Apply for Cohort 0" />
              <a href="#events" className="text-sm text-white/70 hover:text-white font-medium flex items-center gap-2 transition-colors">
                Join Our Events
              </a>
            </div>
          </FadeIn>
        </section>

        {/* Section 1.5: About */}
        <FadeIn>
          <section id="about" className="text-center space-y-4 max-w-4xl mx-auto pt-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight px-4 sm:px-0">About Context Window HQ</h2>
            <p className="text-base sm:text-lg text-white/70 leading-relaxed text-center px-6 sm:px-0">
              Context Window HQ is a zero-friction, high-density hacker house located in Bengaluru, built exclusively for the top 1% of AI engineers. We clear your mental cache and provide raw compute, frictionless capital, and elite peers so you can produce world-class infrastructure.
            </p>
          </section>
        </FadeIn>


        {/* Section 3: The Infrastructure */}
        <section className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">The Infrastructure</h2>
            </div>
          </FadeIn>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FadeIn delay={0.1}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">High-Speed Compute</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Stop worrying about API limits. We secure massive credit pools across AWS, Cloudflare, and top-tier foundation models so your agentic workflows run without a bottleneck.
                </p>
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">Frictionless Capital</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Need a domain? Need to spin up an ECS Fargate cluster? We provide instant micro-grants for infrastructure. Zero approval pipelines, zero reimbursement forms.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="liquid-glass rounded-3xl p-8 hover:scale-[1.02] transition-transform">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-3">High-Density Context</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  You are the average of the five builders around you. Surround yourself with system architects, Next.js heavyweights, and devs deploying local reasoning models.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* New Section: The Founders */}
        <section className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">The Architects.</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mt-4">
                Built by engineers who understand the friction of shipping.
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

        {/* Section: Events */}
        <section id="events" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">Upcoming Events</h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mt-4">
                Join our exclusive meetups and hackathons in Bengaluru.
              </p>
            </div>
          </FadeIn>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <FadeIn delay={0.1} className="h-full">
              <div className="liquid-glass rounded-3xl p-8 h-full flex flex-col justify-between gap-6">
                <div>
                  <div className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-2">OCT 24 • HSR Layout</div>
                  <h3 className="text-2xl font-medium mb-3">Multi-Agent Hackathon</h3>
                  <p className="text-white/60">A 24-hour sprint to build autonomous agent swarms. Bring your own compute, we provide the API credits and Red Bull.</p>
                </div>
                <div>
                  <LiquidMetalButton label="RSVP Now" />
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={0.2} className="h-full">
              <div className="liquid-glass rounded-3xl p-8 h-full flex flex-col justify-between gap-6">
                <div>
                  <div className="text-white/50 text-sm font-semibold tracking-widest uppercase mb-2">NOV 12 • Indiranagar</div>
                  <h3 className="text-2xl font-medium mb-3">Local LLM Deployment Mixer</h3>
                  <p className="text-white/60">Connect with researchers and infra engineers running deep reasoning models on local hardware. Drinks are on us.</p>
                </div>
                <div>
                  <LiquidMetalButton label="RSVP Now" />
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 5: The Execution */}
        <section id="sprint" className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">The Genesis Sprint.</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FadeIn delay={0.1} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <MapPin className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Location</span>
                <strong className="text-base font-medium">HSR Layout, Bengaluru</strong>
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Calendar className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Duration</span>
                <strong className="text-base font-medium">30 Days of Intense Building</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.3} className="h-full">
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Users2 className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Capacity</span>
                <strong className="text-base font-medium">5 Founding Engineers</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.4} className="h-full">
              <div className="liquid-glass-strong rounded-3xl p-6 flex flex-col items-center text-center h-full">
                <Code2 className="w-8 h-8 text-white mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/70 mb-1 font-semibold">The Only Rule</span>
                <strong className="text-base font-medium">Mandatory Midnight Demos</strong>
                <p className="text-xs text-white/60 mt-2">Every single day, you prove your work visually. No text updates. Show the deployment.</p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Section 6: Footer & Final CTA */}
        <FadeIn>
          <footer className="pt-20 pb-12 flex flex-col items-center text-center border-t border-white/10">
            <h2 className="text-4xl lg:text-6xl font-medium tracking-tight mb-6 max-w-4xl">
              Ready to expand your <em className="font-serif italic font-normal text-white/80">context?</em>
            </h2>
            <p className="text-lg text-white/60 mb-10 font-medium">
              Applications for Cohort 0 close soon. Show us what you are shipping.
            </p>
            <LiquidMetalButton label="Initialize Application" />
            
            <div className="mt-24 text-white/40 text-sm font-medium">
              © 2026 Context Window HQ. All rights reserved.
            </div>
          </footer>
        </FadeIn>

      </div>
    </main>
  );
}
