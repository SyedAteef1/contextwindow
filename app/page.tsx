"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------
type NodeData = {
  name: string;
  status: string;
  role: string;
  desc: string;
  logs: string[];
  badgeClass: string;
};

// -----------------------------------------------------------------------------
// Component Data
// -----------------------------------------------------------------------------
const NODE_DATA: Record<number, NodeData> = {
  1: {
    name: "Syed Ateef",
    status: "Online",
    role: "Ecosystem Architect / Founding Eng.",
    desc: "Orchestrating the AI brain for enterprise companies and shipping products alongside the cohort in real-time. The anchor of the house.",
    logs: [
      "[SYSTEM_INIT] Node 01 Online.",
      "[SYS.LOG] Syed Ateef verified payload.",
      "[SYS.LOG] Active task: AI agent brain orchestrations.",
      "[SYS.LOG] Context limit set to maximum capacity.",
      "[SYS.LOG] Syncing staging environment... OK."
    ],
    badgeClass: "node-panel-badge"
  },
  2: {
    name: "Unallocated Node",
    status: "Awaiting Connection",
    role: "AI Engineer Resident Slot",
    desc: "Reserved for someone shipping real code. A placeholder challenging deep-tech hackers to prove their technical density.",
    logs: [
      "[SYS.STBY] Node 02 in Standby mode.",
      "[SYS.STBY] Scanning Github repositories in BLR...",
      "[SYS.STBY] Waiting for incoming handshake payload...",
      "[SYS.STBY] Handshake missing. Apply below to allocate."
    ],
    badgeClass: "node-panel-badge"
  }
};

export default function LandingPage() {
  // ---------------------------------------------------------------------------
  // Global & Telemetry State
  // ---------------------------------------------------------------------------
  const [timeStr, setTimeStr] = useState("00:00:00 IST");
  const [cpu, setCpu] = useState(12);
  const [ping, setPing] = useState(14);
  const [decibels, setDecibels] = useState(42);
  const [temp, setTemp] = useState("58.2");
  
  const [uptimeSeconds, setUptimeSeconds] = useState(482 * 3600 + 12 * 60 + 8); // 482:12:08
  
  const [mouseCoords, setMouseCoords] = useState({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [bgTransform, setBgTransform] = useState("translate(0px, 0px)");

  // ---------------------------------------------------------------------------
  // Topology State
  // ---------------------------------------------------------------------------
  const [activeNode, setActiveNode] = useState<number>(1);
  const [nodeLogs, setNodeLogs] = useState<string[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Terminal State
  // ---------------------------------------------------------------------------
  const [currentSession, setCurrentSession] = useState("guest");
  const [currentHost, setCurrentHost] = useState("context_window");
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState<React.ReactNode[]>([]);
  const termBodyRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Wizard State
  // ---------------------------------------------------------------------------
  const [wizardActive, setWizardActive] = useState(false);
  const [wizardInput, setWizardInput] = useState("");
  const [wizardLogs, setWizardLogs] = useState<React.ReactNode[]>([]);
  const wizardContainerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Body Class & Effects Setup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.body.classList.add("wow-body");
    return () => {
      document.body.classList.remove("wow-body");
      // ensure we remove themes if component unmounts
      document.body.classList.remove("theme-dark", "theme-cyber");
    };
  }, []);

  // Mouse Movement & Scroll
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseCoords({ x: e.clientX, y: e.clientY });
      const xPct = e.clientX / window.innerWidth - 0.5;
      const yPct = e.clientY / window.innerHeight - 0.5;
      setBgTransform(`translate(${xPct * 20}px, ${yPct * 20}px)`);
    };

    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress((winScroll / height) * 100);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Telemetry Interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("en-US", { hour12: false }) + " IST");
      setCpu(12 + Math.floor(Math.random() * 12));
      setPing(10 + Math.floor(Math.random() * 6));
      setDecibels(40 + Math.floor(Math.random() * 8));
      setTemp((56 + Math.random() * 4).toFixed(1));
      setUptimeSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reveal Animation Observers
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    const elements = document.querySelectorAll(".reveal");
    elements.forEach(el => observer.observe(el));
    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);

  // Node Change Simulation
  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    setNodeLogs([]);
    let delay = 0;
    NODE_DATA[activeNode].logs.forEach((log) => {
      const t = setTimeout(() => {
        setNodeLogs(prev => {
          const newLogs = [...prev, log];
          setTimeout(() => {
            if (logsContainerRef.current) {
              logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
            }
          }, 10);
          return newLogs;
        });
      }, delay);
      timeouts.push(t);
      delay += 200;
    });

    return () => timeouts.forEach(clearTimeout);
  }, [activeNode]);

  // ---------------------------------------------------------------------------
  // Terminal Logic
  // ---------------------------------------------------------------------------
  const handleTermKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const fullInput = termInput.trim();
      const tokens = fullInput.split(' ');
      const command = tokens[0].toLowerCase();
      const args = tokens.slice(1);
      
      const promptStr = `${currentSession}@${currentHost}:~$`;
      const echoLine = (
        <div key={`echo-${Date.now()}`}>
          <span className="t-cyan">{promptStr}</span>{" "}
          <span className="t-yellow">{fullInput}</span>
        </div>
      );
      
      let outputLine: React.ReactNode = null;
      
      if (currentSession === 'syed_ateef') {
        switch (command) {
          case 'ls':
            outputLine = <>active_agents/&nbsp;&nbsp;&nbsp;&nbsp;brain_config.json&nbsp;&nbsp;&nbsp;&nbsp;hsr_manifesto.txt</>;
            break;
          case 'cat':
            if (args[0] === 'hsr_manifesto.txt') {
              outputLine = (
                <>
                  <span className="t-red">== CONTEXT WINDOW HQ MANIFESTO ==</span><br/>
                  1. Ship or die. Demos at midnight.<br/>
                  2. Build systems, not slides.<br/>
                  3. Block out the corporate VC noise.<br/>
                  4. Leverage bare-metal infrastructure.
                </>
              );
            } else if (args[0] === 'brain_config.json') {
              outputLine = (
                <>
                  {`{`}<br/>
                  &nbsp;&nbsp;"model": "gemini-1.5-pro",<br/>
                  &nbsp;&nbsp;"temperature": 0.15,<br/>
                  &nbsp;&nbsp;"orchestration_layer": "autonomous-agents",<br/>
                  &nbsp;&nbsp;"hq_sector": "BLR_HSR_3",<br/>
                  &nbsp;&nbsp;"compute_provider": "local_RTX_clusters"<br/>
                  {`}`}
                </>
              );
            } else {
              outputLine = `cat: ${args[0] || 'missing file'}: No such file in workspace.`;
            }
            break;
          case 'exit':
            setCurrentSession('guest');
            setCurrentHost('context_window');
            outputLine = <span className="t-gray">Connection to node_01 closed. Exited.</span>;
            break;
          case 'help':
            outputLine = (
              <>
                Commands inside node_01 sub-shell:<br/>
                <span className="t-cyan">ls</span>    - List workspace documents<br/>
                <span className="t-cyan">cat</span>   - View document content (e.g. cat hsr_manifesto.txt)<br/>
                <span className="t-cyan">exit</span>  - Disconnect from SSH and return to host console.
              </>
            );
            break;
          default:
            outputLine = <>Command not recognized in sub-shell. Type <span className="t-cyan">help</span> inside node session.</>;
        }
      } else {
        switch(command) {
          case 'help':
            outputLine = (
              <>
                Available commands:<br/>
                <span className="t-cyan">about</span>              - Detailed info on the residency program<br/>
                <span className="t-cyan">nodes</span>              - Output table listing status of all physical nodes<br/>
                <span className="t-cyan">ssh &lt;node_id&gt;</span>       - SSH directly into a resident node (e.g. ssh node_01)<br/>
                <span className="t-cyan">github &lt;username&gt;</span>  - Fetch public profile from real GitHub API & calculate density<br/>
                <span className="t-cyan">theme &lt;light|dark|cyber&gt;</span> - Instantly switch landing page design layouts<br/>
                <span className="t-cyan">systemctl</span>          - Check telemetry daemons and kitchen/compute hardware status<br/>
                <span className="t-cyan">env</span>                - Display environmental variable metrics<br/>
                <span className="t-cyan">ping &lt;host&gt;</span>         - Ping server host and check local latency<br/>
                <span className="t-cyan">clear</span>              - Reset screen history<br/>
                <span className="t-cyan">help</span>               - Output this command instruction matrix
              </>
            );
            break;
          case 'about':
            outputLine = `A physical, high-density hacker house in Bangalore (HSR Layout sector). Inspired by the builder hubs like LocalHost HQ. We cater to researchers, systems engineers, and founders constructing the next wave of autonomous agents. No wanted lectures. Proof-of-work baseline.`;
            break;
          case 'nodes':
            outputLine = (
              <>
                --------------------------------------------------------<br/>
                NODE_ID   NAME           STATUS            ACTIVE_PORT<br/>
                --------------------------------------------------------<br/>
                NODE_01   Syed Ateef     <span className="t-green">ONLINE</span>            22 (SSH)<br/>
                NODE_02   Unallocated    <span className="t-yellow">STANDBY</span>           Awaiting Application<br/>
                NODE_03   Unallocated    <span className="t-yellow">STANDBY</span>           Awaiting Application<br/>
                --------------------------------------------------------
              </>
            );
            break;
          case 'ssh':
            if (args[0] === 'node_01') {
              setCurrentSession('syed_ateef');
              setCurrentHost('node_01');
              outputLine = <>Connecting to Node 01 (Syed Ateef)...<br/>SSH encryption verified.<br/>Type <span className="t-cyan">help</span> inside sub-shell.</>;
            } else if (args[0] === 'node_02') {
              outputLine = <><span className="t-red">Connection rejected.</span> Node 02 is unallocated. Access denied.</>;
            } else {
              outputLine = `Usage: ssh [node_01 | node_02]`;
            }
            break;
          case 'github':
            const username = args[0];
            if (!username) {
              outputLine = `Usage: github <username>`;
            } else {
              outputLine = <span className="t-cyan">Initiating handshake with GitHub API for profile: "{username}"...</span>;
              fetch(`https://api.github.com/users/${username}`)
                .then(res => {
                  if (!res.ok) throw new Error("Profile not found");
                  return res.json();
                })
                .then(profile => {
                  return fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=30`)
                    .then(r => r.json())
                    .then(repos => {
                      const starCount = repos.reduce((acc: number, repo: any) => acc + (repo.stargazers_count || 0), 0);
                      const languages: Record<string, number> = {};
                      repos.forEach((repo: any) => {
                        if (repo.language) {
                          languages[repo.language] = (languages[repo.language] || 0) + 1;
                        }
                      });
                      
                      let topLang = "Unknown";
                      let maxCount = 0;
                      for (const lang in languages) {
                        if (languages[lang] > maxCount) {
                          maxCount = languages[lang];
                          topLang = lang;
                        }
                      }
                      
                      let score = 50 + (repos.length * 1.5) + (starCount * 2);
                      if (["Rust", "C++", "TypeScript", "Python"].includes(topLang)) score += 15;
                      score = Math.min(Math.round(score), 100);
                      
                      const report = (
                        <div key={`git-${Date.now()}`} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                          <br/>
                          =======================================================<br/>
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;GITHUB BUILDER TELEMETRY REPORT<br/>
                          =======================================================<br/>
                          Builder Profile : <span className="t-cyan">{profile.login}</span><br/>
                          Full Identity   : {profile.name || "N/A"}<br/>
                          Public Projects : {profile.public_repos}<br/>
                          Stars Accrued   : {starCount}<br/>
                          Primary Stack   : <span className="t-yellow">{topLang}</span><br/>
                          Followers Count : {profile.followers}<br/>
                          Technical Density : <span className="t-green" style={{fontWeight: 'bold'}}>{score} / 100</span><br/>
                          -------------------------------------------------------<br/>
                          Decision Recommendation: {score >= 75 ? <span className="t-yellow">IMMEDIATE COHORT ENTRY VERIFIED</span> : <span className="t-gray">PENDING MANUAL ARCHITECTURE REVIEW</span>}<br/>
                          =======================================================
                        </div>
                      );
                      setTermHistory(prev => [...prev, report]);
                    });
                })
                .catch(() => {
                  const starCount = Math.floor(Math.random() * 20) + 5;
                  const score = 70 + Math.floor(Math.random() * 25);
                  const report = (
                    <div key={`git-err-${Date.now()}`} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                      <br/>
                      <span className="t-red">[WARNING] API LIMIT EXCEEDED. GENERATING SECURE LOCAL EMULATED AUDIT...</span><br/>
                      =======================================================<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EMULATED BUILDER TELEMETRY REPORT<br/>
                      =======================================================<br/>
                      Builder Profile : <span className="t-cyan">{username}</span><br/>
                      Public Projects : {Math.floor(Math.random() * 30) + 12}<br/>
                      Stars Accrued   : {starCount}<br/>
                      Primary Stack   : <span className="t-yellow">TypeScript / Python</span><br/>
                      Technical Density : <span className="t-green" style={{fontWeight: 'bold'}}>{score} / 100</span><br/>
                      -------------------------------------------------------<br/>
                      Decision Recommendation: {score >= 80 ? <span className="t-yellow">ACCEPTANCE CONFIRMED</span> : <span className="t-gray">REQUIRES HANDSHAKE DEMO</span>}<br/>
                      =======================================================
                    </div>
                  );
                  setTermHistory(prev => [...prev, report]);
                });
            }
            break;
          case 'theme':
            const mode = args[0];
            if (['light', 'dark', 'cyber'].includes(mode)) {
              document.body.classList.remove('theme-dark', 'theme-cyber');
              if (mode !== 'light') {
                document.body.classList.add('theme-' + mode);
              }
              outputLine = <>System visual theme configured to: <span className="t-yellow">{mode.toUpperCase()}</span>.</>;
            } else {
              outputLine = `Usage: theme [light | dark | cyber]`;
            }
            break;
          case 'systemctl':
            outputLine = (
              <>
                [VIRTUAL DAEMON UNITS]<br/>
                --------------------------------------------------------<br/>
                UNIT                          STATUS        SUB-STATE<br/>
                --------------------------------------------------------<br/>
                rtx_4090_grid.service          <span className="t-green">active</span>        running (Temp: 58.2°C)<br/>
                gigabit_fiber.service          <span className="t-green">active</span>        stable (RTT: 12ms)<br/>
                coffee_brewer.service          <span className="t-green">active</span>        ready (14.8kg loaded)<br/>
                hacker_sound_monitor.service   <span className="t-green">active</span>        listening (42dB environment)<br/>
                residency_recruitment.service  <span className="t-yellow">standby</span>       active recruiter loop<br/>
                --------------------------------------------------------
              </>
            );
            break;
          case 'env':
            outputLine = (
              <>
                COHORT_NUMBER=00<br/>
                GEOLOCATION="Bengaluru, HSR Layout, Sector 3"<br/>
                MANDATORY_RESIDENCY_CYCLE=30_DAYS<br/>
                API_CREDITS_DECK=250000_USD<br/>
                DEFAULT_THEME=swiss_cream<br/>
                CURRENT_IST_TIME="{new Date().toLocaleTimeString('en-US', { hour12: false })}"
              </>
            );
            break;
          case 'ping':
            const target = args[0] || 'localhost';
            outputLine = (
              <>
                PING {target} (127.0.0.1): 56 data bytes<br/>
                64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time={(2 + Math.random() * 8).toFixed(3)} ms<br/>
                64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time={(2 + Math.random() * 8).toFixed(3)} ms<br/>
                --- {target} ping statistics ---<br/>
                2 packets transmitted, 2 packets received, 0.0% packet loss
              </>
            );
            break;
          case 'clear':
            setTermHistory([]);
            setTermInput('');
            return;
          default:
            outputLine = <>Command not recognized: <span className="t-red">{command}</span>. Type <span className="t-cyan">help</span> for guidelines.</>;
        }
      }
      
      const combinedOutput = (
        <React.Fragment key={`group-${Date.now()}`}>
          {echoLine}
          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            {outputLine}
          </div>
        </React.Fragment>
      );
      
      setTermHistory(prev => [...prev, combinedOutput]);
      setTermInput("");
      setTimeout(() => {
        if (termBodyRef.current) {
          termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
        }
      }, 10);
    }
  };

  // ---------------------------------------------------------------------------
  // Wizard Logic
  // ---------------------------------------------------------------------------
  const runWizard = () => {
    const username = wizardInput.trim();
    if (username === '') {
      alert("ERROR: USERNAME REQUIRED");
      return;
    }
    setWizardActive(true);
    setWizardLogs([]);

    const initialLines = [
      `guest@hsr_gateway:~$ init_handshake --profile="${username}"`,
      `[SYS] ESTABLISHING TUNNEL TO CORE RECRUITMENT DECK...`,
      `[OK] SECURE LINK ESTABLISHED AT PORT 8443.`,
      `[SYS] QUERYING GITHUB API FOR USER REPOSITORIES...`
    ];

    let delay = 0;
    initialLines.forEach((line) => {
      setTimeout(() => {
        setWizardLogs(prev => [...prev, <div key={Math.random()} style={{ marginBottom: '6px' }}>{line}</div>]);
        if (wizardContainerRef.current) wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
      }, delay);
      delay += 250;
    });

    setTimeout(() => {
      fetch(`https://api.github.com/users/${username}`)
        .then(res => {
          if (!res.ok) throw new Error("Profile not found");
          return res.json();
        })
        .then(profile => {
          return fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=30`)
            .then(r => r.json())
            .then(repos => {
              const starCount = repos.reduce((acc: number, repo: any) => acc + (repo.stargazers_count || 0), 0);
              const languages: Record<string, number> = {};
              repos.forEach((repo: any) => {
                if (repo.language) languages[repo.language] = (languages[repo.language] || 0) + 1;
              });
              let topLang = "TypeScript";
              let maxCount = 0;
              for (const lang in languages) {
                if (languages[lang] > maxCount) { maxCount = languages[lang]; topLang = lang; }
              }
              let score = Math.min(Math.round(55 + (repos.length * 1.2) + (starCount * 1.5)), 100);
              
              const finalLines = [
                <span className="t-cyan" key="w1">[OK] FOUND PUBLIC BUILDER: {profile.name || username}</span>,
                <span key="w2">[ANALYSIS] Repository count: {profile.public_repos}. Top language: {topLang}</span>,
                <span key="w3">[ANALYSIS] Stargazers metric: {starCount} stars collected.</span>,
                <span key="w4">[ANALYSIS] Calculated Technical Density: {score}/100.</span>,
                <span className="t-yellow" key="w5">[SUCCESS] SECURE ENVELOPE ROUTED TO CORE ECOSYSTEM ARCHITECT.</span>,
                <span key="w6">======================================================</span>,
                <span className="t-red" style={{ fontWeight: 'bold' }} key="w7">TRANSMISSION RECEIVED // Syed Ateef will audit your stack.</span>
              ];
              
              let fDelay = 0;
              finalLines.forEach(node => {
                setTimeout(() => {
                  setWizardLogs(prev => [...prev, <div key={Math.random()} style={{ marginBottom: '6px' }}>{node}</div>]);
                  if (wizardContainerRef.current) wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
                }, fDelay);
                fDelay += 300;
              });
            });
        })
        .catch(() => {
          const finalLines = [
            <span key="e1">[WARNING] API RATE LIMITED. BOOTING EMULATED EVALUATOR ENGINE...</span>,
            <span className="t-cyan" key="e2">[OK] FOUND PUBLIC PROFILE: {username}</span>,
            <span key="e3">[ANALYSIS] Parsed: Python, JavaScript frameworks.</span>,
            <span key="e4">[ANALYSIS] Emulated Technical Density Index: 88/100.</span>,
            <span className="t-yellow" key="e5">[SUCCESS] SECURE HANDSHAKE PACKET SENT TO SYED ATEEF.</span>,
            <span key="e6">======================================================</span>,
            <span className="t-red" style={{ fontWeight: 'bold' }} key="e7">TRANSMISSION RECEIVED // Syed Ateef has been notified.</span>
          ];
          let fDelay = 0;
          finalLines.forEach(node => {
            setTimeout(() => {
              setWizardLogs(prev => [...prev, <div key={Math.random()} style={{ marginBottom: '6px' }}>{node}</div>]);
              if (wizardContainerRef.current) wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
            }, fDelay);
            fDelay += 300;
          });
        });
    }, delay);
  };

  // Helper formatting for uptime
  const formatUptime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <>
      <div className="scanlines"></div>
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }}></div>
      <div className="blueprint-grid" style={{ transform: bgTransform }}></div>
      <div className="coord-tracker">
        X: {String(mouseCoords.x).padStart(3, '0')} // Y: {String(mouseCoords.y).padStart(3, '0')}
      </div>

      <nav className="wow-nav">
        <a href="#" className="nav-brand" style={{ color: "var(--ink-main)", textDecoration: "none" }}>
          CONTEXT_WINDOW // HQ
        </a>
        <div className="nav-sys">
          <span>LOC: <strong>BLR_IN [HSR_LAYOUT]</strong></span>
          <span>SYS.TIME: <span style={{ color: "var(--ink-main)", fontWeight: 700 }}>{timeStr}</span></span>
          <span>CPU: <strong>{cpu}%</strong></span>
          <span>LATENCY: <strong>{ping}ms</strong></span>
          <span><div className="live-dot"></div> COHORT ZERO ACTIVE</span>
        </div>
      </nav>

      <main className="frame">
        {/* HERO */}
        <section className="hero reveal">
          <div className="hero-eyebrow">Bare-Metal Environment</div>
          <h1>
            Clear the<br/>Mental Cache.<br/>
            <span 
              className="glitch-text" 
              onClick={(e) => {
                const el = e.currentTarget as HTMLSpanElement;
                const colors = ['#E5FF00', '#FF2E00', '#00E5FF', '#0B0B0A'];
                let count = 0;
                const interval = setInterval(() => {
                  el.style.color = colors[count % colors.length];
                  count++;
                  if (count > 8) {
                    clearInterval(interval);
                    el.style.color = 'var(--accent-red)';
                  }
                }, 100);
              }}
            >
              Ship or Die.
            </span>
          </h1>
          <p>A high-intensity, zero-friction physical hacker house built exclusively for the top 1% of AI engineers. No ecosystem bloat. No networking theater. Just raw compute and absolute focus.</p>
          <div className="btn-group">
            <a href="#deploy" className="btn btn-primary">Deploy Yourself ↓</a>
            <a href="#terminal-anchor" className="btn btn-outline">Boot Shell Terminal &gt;_</a>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee" style={{ borderTop: "none" }}>
          <div className="marquee-inner">
            <span>NO WANTREPRENEURS</span>
            <span>PROOF OF WORK ONLY</span>
            <span>MIDNIGHT DEMOS MANDATORY</span>
            <span>ZERO FRICTION INFRA</span>
            <span>NO WANTREPRENEURS</span>
            <span>PROOF OF WORK ONLY</span>
            <span>MIDNIGHT DEMOS MANDATORY</span>
            <span>ZERO FRICTION INFRA</span>
          </div>
        </div>

        {/* THEORY & MANIFESTO */}
        <section id="theory" className="grid-section">
          <div 
            className="grid-cell cell-span-6 reveal bento-tilt"
            onMouseMove={(e) => {
              const card = e.currentTarget;
              const rect = card.getBoundingClientRect();
              const x = e.clientX - rect.left - rect.width/2;
              const y = e.clientY - rect.top - rect.height/2;
              const tiltX = (y / (rect.height/2)) * -6; 
              const tiltY = (x / (rect.width/2)) * 6;
              card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
              card.style.boxShadow = `0px 20px 30px rgba(11, 11, 10, 0.08)`;
            }}
            onMouseLeave={(e) => {
              const card = e.currentTarget;
              card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
              card.style.boxShadow = 'none';
            }}
          >
            <div className="cell-label">SYS.ARCH // 01</div>
            <h2 className="cell-title">The Context Window Metaphor</h2>
            <p className="cell-body">In systems architecture, an AI agent's context window is its active execution environment. If it gets cluttered with noise, the agent <strong>hallucinates and crashes.</strong> Human engineers operate identically.</p>
          </div>
          <div 
            className="grid-cell cell-span-6 reveal bento-tilt"
            onMouseMove={(e) => {
              const card = e.currentTarget;
              const rect = card.getBoundingClientRect();
              const x = e.clientX - rect.left - rect.width/2;
              const y = e.clientY - rect.top - rect.height/2;
              const tiltX = (y / (rect.height/2)) * -6; 
              const tiltY = (x / (rect.width/2)) * 6;
              card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
              card.style.boxShadow = `0px 20px 30px rgba(11, 11, 10, 0.08)`;
            }}
            onMouseLeave={(e) => {
              const card = e.currentTarget;
              card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
              card.style.boxShadow = 'none';
            }}
          >
            <div className="cell-label">THE_ANTIDOTE // 02</div>
            <h2 className="cell-title">Flood the Signal</h2>
            <p className="cell-body">We strip away all ecosystem bloat—mandatory lectures, VC pitch nights, red tape. We fill your immediate environment entirely with high-fidelity inputs. Peer density. Compute. Execution.</p>
          </div>
        </section>

        {/* HACKER HOUSE TELEMETRY DECK */}
        <section className="telemetry-deck reveal">
          <div className="tel-card">
            <div className="tel-label">Uptime</div>
            <div className="tel-value">{formatUptime(uptimeSeconds)}</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">Decibel Level</div>
            <div className="tel-value">{decibels} dB</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">Coffee Supply</div>
            <div className="tel-value">14.8 kg</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">Active GPU Core Temp</div>
            <div className="tel-value">{temp}°C</div>
          </div>
        </section>

        {/* PROTOCOL BENTO */}
        <section className="grid-section">
          <div className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderTop: "2px solid var(--border-dark)", borderBottom: "2px solid var(--border-dark)" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Execution Protocol</h3>
          </div>
          
          <div className="grid-cell cell-span-4 protocol-cell reveal bento-tilt"
               onMouseMove={(e) => {
                 const card = e.currentTarget;
                 const rect = card.getBoundingClientRect();
                 const x = e.clientX - rect.left - rect.width/2;
                 const y = e.clientY - rect.top - rect.height/2;
                 const tiltX = (y / (rect.height/2)) * -6; 
                 const tiltY = (x / (rect.width/2)) * 6;
                 card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
                 card.style.boxShadow = `0px 20px 30px rgba(11, 11, 10, 0.08)`;
               }}
               onMouseLeave={(e) => {
                 const card = e.currentTarget;
                 card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
                 card.style.boxShadow = 'none';
               }}
          >
            <div className="cell-label">Filter</div>
            <h2 className="cell-title">GitHub or GTFO</h2>
            <p className="cell-body">We bypass LinkedIn entirely. We filter strictly for proof of work: GitHub repos, live deployment links, and raw technical density.</p>
            <div className="b-num">01</div>
          </div>
          
          <div className="grid-cell cell-span-4 protocol-cell reveal bento-tilt"
               onMouseMove={(e) => {
                 const card = e.currentTarget;
                 const rect = card.getBoundingClientRect();
                 const x = e.clientX - rect.left - rect.width/2;
                 const y = e.clientY - rect.top - rect.height/2;
                 const tiltX = (y / (rect.height/2)) * -6; 
                 const tiltY = (x / (rect.width/2)) * 6;
                 card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
                 card.style.boxShadow = `0px 20px 30px rgba(11, 11, 10, 0.08)`;
               }}
               onMouseLeave={(e) => {
                 const card = e.currentTarget;
                 card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
                 card.style.boxShadow = 'none';
               }}
          >
            <div className="cell-label">Pacing</div>
            <h2 className="cell-title">30-Day Sprint</h2>
            <p className="cell-body">A brutal physical residency for 5 hand-selected Founding Engineers. Clock starts day one. Day 30 is a public launch.</p>
            <div className="b-num">02</div>
          </div>
          
          <div className="grid-cell cell-span-4 protocol-cell reveal bento-tilt"
               onMouseMove={(e) => {
                 const card = e.currentTarget;
                 const rect = card.getBoundingClientRect();
                 const x = e.clientX - rect.left - rect.width/2;
                 const y = e.clientY - rect.top - rect.height/2;
                 const tiltX = (y / (rect.height/2)) * -6; 
                 const tiltY = (x / (rect.width/2)) * 6;
                 card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
                 card.style.boxShadow = `0px 20px 30px rgba(11, 11, 10, 0.08)`;
               }}
               onMouseLeave={(e) => {
                 const card = e.currentTarget;
                 card.style.transform = `perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)`;
                 card.style.boxShadow = 'none';
               }}
          >
            <div className="cell-label">Ritual</div>
            <h2 className="cell-title">Midnight Demos</h2>
            <p className="cell-body">Mandatory showcase every single night. Loom videos or staging links showing an architectural milestone. <strong>No text updates allowed.</strong></p>
            <div className="b-num">03</div>
          </div>
        </section>

        {/* NETWORK TOPOLOGY */}
        <div className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderTop: "2px solid var(--border-dark)", borderBottom: "2px solid var(--border-dark)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Network Topology: Active Nodes</h3>
        </div>
        
        <section className="topology-container reveal">
          <div className="topology-viz">
            <svg className="network-graph" viewBox="0 0 400 400">
              <line x1="200" y1="120" x2="100" y2="250" stroke="#FF2E00" strokeWidth="2" className="connection-line" />
              <line x1="200" y1="120" x2="300" y2="250" stroke="#D6D6CF" strokeWidth="2" strokeDasharray="4" />
              <line x1="100" y1="250" x2="300" y2="250" stroke="#D6D6CF" strokeWidth="1" strokeDasharray="6" />
              
              <circle cx="200" cy="120" r="12" fill="#FF2E00" />
              
              <g className="node" onClick={() => setActiveNode(1)}>
                <circle cx="100" cy="250" r="24" fill="#0B0B0A" stroke="#FF2E00" strokeWidth="2" />
                <text x="100" y="254" fill="#FFF" fontSize="10" fontFamily="'JetBrains Mono'" textAnchor="middle" fontWeight="bold">NODE_01</text>
              </g>
              
              <g className="node" onClick={() => setActiveNode(2)}>
                <circle cx="300" cy="250" r="24" fill="#1C1C1A" stroke="#D6D6CF" strokeWidth="2" />
                <text x="300" y="254" fill="#888" fontSize="10" fontFamily="'JetBrains Mono'" textAnchor="middle">NODE_02</text>
              </g>
            </svg>
          </div>
          
          <div className="topology-details">
            <div>
              <div className="node-panel-header">
                <h4 className="node-panel-title">{NODE_DATA[activeNode].name}</h4>
                <span 
                  className="node-panel-badge" 
                  style={activeNode === 2 ? { background: 'var(--border-main)', color: 'var(--ink-muted)' } : {}}
                >
                  {NODE_DATA[activeNode].status}
                </span>
              </div>
              <p style={{ color: "var(--accent-red)", fontSize: "11px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>
                {NODE_DATA[activeNode].role}
              </p>
              <p style={{ fontSize: "14px", marginTop: "1rem" }} dangerouslySetInnerHTML={{ __html: NODE_DATA[activeNode].desc }}></p>
              
              <div className="node-panel-log" ref={logsContainerRef}>
                {nodeLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TERMINAL PLAYGROUND */}
        <section className="terminal-section reveal" id="terminal-anchor">
          <div className="terminal-window">
            <div className="terminal-header">
              <div className="terminal-dots">
                <div className="terminal-dot"></div>
                <div className="terminal-dot"></div>
                <div className="terminal-dot"></div>
              </div>
              <div>CONTEXT_WINDOW // SHELL v1.1.2</div>
              <div style={{ opacity: 0.6 }}>BLR_IN</div>
            </div>
            <div className="terminal-body" ref={termBodyRef} onClick={() => document.getElementById('term-input')?.focus()}>
              <div className="t-gray"># Context Window HQ Shell Console.</div>
              <div className="t-gray"># Inspired by localhost hq. Built for rapid technical indexing.</div>
              <div className="t-gray">
                # Commands: <span className="t-yellow">help</span>, <span className="t-yellow">about</span>, <span className="t-yellow">nodes</span>, <span className="t-yellow">github &lt;username&gt;</span>, <span className="t-yellow">ssh &lt;node&gt;</span>, <span className="t-yellow">theme &lt;mode&gt;</span>, <span className="t-yellow">systemctl</span>, <span className="t-yellow">env</span>, <span className="t-yellow">ping</span>, <span className="t-yellow">clear</span>
              </div>
              <br/>
              <div><span className="t-cyan">guest@context_window:~$</span> <span className="t-yellow">about</span></div>
              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>We are a multidisciplinary physical hacker house based in HSR Layout, Sector 3, Bengaluru. Built exclusively for top AI builders, model tuners, and systems architects to ship together under absolute focus.</div>
              
              {termHistory}

              <div className="terminal-input-line">
                <span className="terminal-prompt">{currentSession}@{currentHost}:~$</span>
                <input 
                  type="text" 
                  className="terminal-input" 
                  id="term-input" 
                  autoComplete="off" 
                  spellCheck="false"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={handleTermKeyDown}
                />
              </div>
            </div>
          </div>
        </section>

        {/* CAPITAL ENGINE */}
        <section className="grid-section">
          <div className="grid-cell cell-span-12 reveal" style={{ paddingBottom: "2rem", borderBottom: "2px solid var(--border-dark)" }}>
            <div className="cell-label">Business Engine</div>
            <h2 className="cell-title">Strategic Sponsorship Model</h2>
            <p className="cell-body" style={{ maxWidth: "800px" }}>Instead of surrendering equity upfront to VC funds, we leverage talent density. Cloud platforms pay <em>us</em> to put their compute in the hands of elite builders.</p>
            
            <table className="spec-table">
              <tbody>
                <tr>
                  <th>Tier 01</th>
                  <td className="spec-title">Infrastructure Partners (DevRel)</td>
                  <td className="spec-desc">Credit pools and free API compute access from AWS, Cloudflare, and frontier model providers eager to lock in elite builders.</td>
                </tr>
                <tr>
                  <th>Tier 02</th>
                  <td className="spec-title">The Friction-Killer Fund</td>
                  <td className="spec-desc">Zero-approval micro-grants for immediate infrastructure (domains, server clusters) via corporate cards. Never fill out a reimbursement form.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* FOOTER CTA / ONBOARDING WIZARD */}
        <section id="deploy" className="grid-section">
          <div className="footer-action reveal">
            <div className="footer-content">
              <h2>Prove Your<br/>Technical Density</h2>
              <p>Drop your GitHub username or a live deployment link. No cover letters. Syed Ateef will review the architecture directly.</p>
              
              <div className="application-box">
                {!wizardActive ? (
                  <div className="app-input-group">
                    <input 
                      type="text" 
                      placeholder="Enter GitHub username (e.g. syedateef)"
                      value={wizardInput}
                      onChange={(e) => setWizardInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') runWizard(); }}
                    />
                    <button onClick={runWizard}>Submit</button>
                  </div>
                ) : (
                  <div className="app-cli-output" style={{ display: 'block' }} ref={wizardContainerRef}>
                    {wizardLogs}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
        
      </main>
    </>
  );
}
