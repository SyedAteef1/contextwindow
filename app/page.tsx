"use client";

import { motion } from "framer-motion";
import { Server, CreditCard, Users, ArrowRight, CheckCircle2, ChevronRight, MapPin, Calendar, Users2, Code2, Menu } from "lucide-react";

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

const founders = [
  {
    name: "Kei Hayashi",
    title: "Co-founder & CEO",
    bio: "Kei co-founded Context Window HQ and leads strategy. Previously at Anthropic, building core infrastructure and large language models.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&q=80",
  },
  {
    name: "Suhas Sumukh",
    title: "Co-founder & COO",
    bio: "Suhas co-founded Context Window HQ and leads all operations. Previously a founding engineer at Merkle Labs, he was working as a software engineer across US-based companies from the age of 16.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
  },
  {
    name: "Hardeep Gambhir",
    title: "Co-Founder, Growth & Strategy",
    bio: "Hardeep drives expansion and ecosystem partnerships. Former growth lead at Vercel where he scaled the developer community globally.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
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
              <button className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                <TwitterIcon className="w-4 h-4 fill-current" />
              </button>
              <button className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                <LinkedinIcon className="w-4 h-4 fill-current" />
              </button>
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
  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white font-sans selection:bg-white/20">
      {/* Background Video */}
      <div className="fixed inset-0 w-full h-full z-0">
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
        className="fixed top-0 left-0 right-0 z-50 p-4 lg:p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent"
      >
        <div className="flex items-center gap-3">
           <div className="liquid-glass w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg">
             CW
           </div>
           <span className="font-semibold text-lg sm:text-xl tracking-tight hidden sm:block">Context Window HQ</span>
        </div>
        <button className="liquid-glass flex items-center justify-center w-10 h-10 rounded-full hover:scale-105 transition-transform active:scale-95">
          <Menu className="w-5 h-5 text-white" />
        </button>
      </motion.header>

      {/* Content Overlay */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24 space-y-32">
        
        {/* Section 1: The Hero */}
        <section className="min-h-[85vh] flex flex-col justify-center items-center text-center pt-20">
          <FadeIn delay={0.1}>
            <div className="liquid-glass rounded-full px-4 py-1.5 mb-8 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/70" />
              <span className="text-xs font-semibold tracking-widest text-white/80">BENGALURU, INDIA • COHORT ZERO OPEN</span>
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
              <button className="liquid-glass-strong rounded-full px-6 py-3 flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform group text-base font-medium">
                Apply for Cohort 0
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="text-sm text-white/70 hover:text-white font-medium flex items-center gap-2 transition-colors">
                View the Manifesto
              </button>
            </div>
          </FadeIn>
        </section>

        {/* Section 2: The Manifesto */}
        <FadeIn>
          <section className="liquid-glass-strong rounded-[2.5rem] p-10 lg:p-16 flex flex-col lg:flex-row gap-12 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight leading-tight">
                We eliminated the friction. <br/>
                <em className="font-serif italic text-white/80">You just build.</em>
              </h2>
            </div>
            <div className="lg:w-1/2">
              <p className="text-base lg:text-lg text-white/70 leading-relaxed">
                Traditional incubators are bloated with networking events, mentors, and mandatory lectures. We stripped the stack down to the bare metal. 
                <br/><br/>
                <strong className="text-white font-medium">Context Window HQ</strong> provides the absolute highest-quality inputs—raw compute, immediate capital, and elite peers—so you can generate world-class outputs. No distractions. Just a room full of people shipping code at 2:00 AM.
              </p>
            </div>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {founders.map((founder, i) => (
              <FadeIn key={founder.name} delay={i * 0.1}>
                <FounderCard founder={founder} />
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Section 4: The Filter */}
        <FadeIn>
          <section className="liquid-glass rounded-[2.5rem] p-8 lg:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight mb-4">
                No Wantrepreneurs. <em className="font-serif italic text-white/80">Only Shippers.</em>
              </h2>
              <p className="text-lg text-white/70 max-w-3xl mx-auto">
                We do not care about your college degree, your LinkedIn title, or your green GitHub squares. We care about your live deployments, your architectural choices, and your ability to hack through production roadblocks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-white/80" />
                  <h3 className="text-lg font-semibold">System Architects</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">Building multi-agent orchestration and autonomous workflows.</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-white/80" />
                  <h3 className="text-lg font-semibold">Infrastructure Hackers</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">Deploying and optimizing local models (Ollama, DeepSeek, Qwen).</p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-white/80" />
                  <h3 className="text-lg font-semibold">Full-Stack Shippers</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">Moving complex UI into pixel-perfect React/Next.js code.</p>
              </div>
            </div>
          </section>
        </FadeIn>

        {/* Section 5: The Execution */}
        <section className="space-y-12">
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl lg:text-4xl font-medium tracking-tight">The Genesis Sprint.</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FadeIn delay={0.1}>
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center">
                <MapPin className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Location</span>
                <strong className="text-base font-medium">HSR Layout, Bengaluru</strong>
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center">
                <Calendar className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Duration</span>
                <strong className="text-base font-medium">30 Days of Intense Building</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center text-center">
                <Users2 className="w-8 h-8 text-white/80 mb-4" />
                <span className="text-xs uppercase tracking-widest text-white/50 mb-1 font-semibold">Capacity</span>
                <strong className="text-base font-medium">5 Founding Engineers</strong>
              </div>
            </FadeIn>

            <FadeIn delay={0.4} className="lg:col-span-1 sm:col-span-2">
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
            <button className="liquid-glass-strong rounded-full px-8 py-4 flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform group text-lg font-medium">
              Initialize Application
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <div className="mt-24 text-white/40 text-sm font-medium">
              © 2026 Context Window HQ. All rights reserved.
            </div>
          </footer>
        </FadeIn>

      </div>
    </main>
  );
}
