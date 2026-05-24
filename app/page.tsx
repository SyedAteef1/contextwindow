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

const CORE_PROCESSES = [
  "llama-3-70b-inference",
  "vector-embedding-indexing",
  "comfyui-video-synthesis",
  "safety-alignment-validation",
  "context-retrieval-query",
  "postgres-pgvector-upsert",
  "whisper-speech-transcription",
  "agent-planning-loop"
];

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



  // Folders Accordion State
  const [activeFolderTab, setActiveFolderTab] = useState<string>("labs");

  // FAQs Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Residency Visualizer States
  const [vizTab, setVizTab] = useState<"founder" | "cluster" | "pipeline" | "latency">("founder");
  const [concurrency, setConcurrency] = useState<number>(64);
  const [thermalLimit, setThermalLimit] = useState<number>(75);
  const [boostedCores, setBoostedCores] = useState<number[]>([]);
  const [hoveredCore, setHoveredCore] = useState<number | null>(null);
  const [pipelineStep, setPipelineStep] = useState<number>(-1);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [networkJitter, setNetworkJitter] = useState<number>(15);

  // Founder Roadmap states
  const [founderProjName, setFounderProjName] = useState<string>("");
  const [founderCategory, setFounderCategory] = useState<string>("agentic");
  const [founderStage, setFounderStage] = useState<string>("prototype");
  const [founderBottleneck, setFounderBottleneck] = useState<string>("compute");
  const [founderGithub, setFounderGithub] = useState<string>("");
  const [isCompilingRoadmap, setIsCompilingRoadmap] = useState<boolean>(false);
  const [roadmapCompiled, setRoadmapCompiled] = useState<boolean>(false);
  const [activeRoadmapWeek, setActiveRoadmapWeek] = useState<number>(1);
  const [roadmapLogs, setRoadmapLogs] = useState<string[]>([]);
  const [pingHistory, setPingHistory] = useState<{ id: number; latency: number; jitter: number }[]>([
    { id: 1, latency: 14, jitter: 1 },
    { id: 2, latency: 12, jitter: 2 },
    { id: 3, latency: 15, jitter: 1 },
    { id: 4, latency: 18, jitter: 3 },
    { id: 5, latency: 13, jitter: 1 },
  ]);

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
  // Residency Visualizer Helpers
  // ---------------------------------------------------------------------------
  const getRoadmapMilestones = (category: string, bottleneck: string) => {
    const data: Record<string, { week1: string; week2: string; week3: string; week4: string }> = {
      agentic: {
        week1: "Setup local model endpoints. Map out memory states and indexing graphs. Allocate GPU cluster slots.",
        week2: "Midnight demo: Establish tool calling and loop execution. Review with systems engineers.",
        week3: "Test multi-agent orchestration. Demo live staging deployment to target SaaS & Seed investors.",
        week4: "Day 30 public launch. Setup telemetry logs, publish research write-up, showcase to investor cohort."
      },
      finetune: {
        week1: "Collect, sanitize and tokenize dataset. Spin up compute nodes. Run base benchmarks.",
        week2: "Midnight demo: Complete baseline training run. Log loss rates. Review weights with Syed Ateef.",
        week3: "Quantize model weights, build serving endpoint. Test model on representative user workflows.",
        week4: "Day 30 public launch. Share Hugging Face hub repositories, host model sandbox, pair with AI infrastructure funds."
      },
      infra: {
        week1: "Provision raw bare-metal servers. Define clustering API layout. Run latency & network load tests.",
        week2: "Midnight demo: Successful task routing across nodes. Benchmark CPU/GPU queues.",
        week3: "Refine orchestration scheduler. Secure initial test teams from active cohort users.",
        week4: "Day 30 public launch. Deploy production-grade system control, release source code, pitch to deep-tech VCs."
      },
      creative: {
        week1: "Install ComfyUI nodes, model weights, and custom pipeline workflows. Benchmark execution pings.",
        week2: "Midnight demo: Generate first high-fidelity temporal-guided sequence. Review with creative devs.",
        week3: "Expose generation as a low-latency web API. Implement user feed showcase sandbox.",
        week4: "Day 30 public launch. Open beta portal, run live showcase, collab with early adopters & media-focused angels."
      }
    };
    const base = data[category] || data.agentic;
    
    // Customize based on bottleneck
    let w1 = base.week1;
    let w2 = base.week2;
    let w3 = base.week3;
    let w4 = base.week4;
    
    if (bottleneck === "compute") {
      w1 = `[COMPUTE GRANTED] ` + w1;
      w2 = w2 + " Optimizing GPU memory maps.";
    } else if (bottleneck === "funding") {
      w3 = `[INVESTOR FOCUS] ` + w3 + " Match with Sequoia, Lightspeed and SaaS syndicate partners.";
    } else if (bottleneck === "talent") {
      w2 = w2 + " Pair with elite systems/ML engineers from our resident network.";
    } else if (bottleneck === "mentorship") {
      w2 = `[FOUNDER LOOP] ` + w2 + " Syed Ateef handles direct architecture audit.";
    }
    
    return { week1: w1, week2: w2, week3: w3, week4: w4 };
  };

  const compileRoadmap = () => {
    if (isCompilingRoadmap) return;
    setIsCompilingRoadmap(true);
    setRoadmapCompiled(false);
    setRoadmapLogs(["[SYSTEM] Initiating Founder Telemetry audit..."]);
    
    const logs = [
      { log: `[15%] Profiling project name: "${founderProjName || 'Unlabeled_Project'}"...`, delay: 300 },
      { log: `[38%] Routing stack matching category: "${founderCategory.toUpperCase()}"...`, delay: 600 },
      { log: `[62%] Adjusting parameters for bottleneck: "${founderBottleneck.toUpperCase()}"...`, delay: 900 },
      { log: `[85%] Verifying GitHub user ID: "${founderGithub || 'anonymous'}"...`, delay: 1200 },
      { log: `[98%] Establishing compute & sector room allocations...`, delay: 1500 },
      { log: `[100%] SUCCESS: Custom roadmap compiled.`, delay: 1800 }
    ];
    
    logs.forEach((item, idx) => {
      setTimeout(() => {
        setRoadmapLogs(prev => [...prev, item.log]);
        if (idx === logs.length - 1) {
          setIsCompilingRoadmap(false);
          setRoadmapCompiled(true);
        }
      }, item.delay);
    });
  };

  const commitToMainframe = () => {
    if (!founderGithub) {
      alert("Please enter a GitHub username in the visualizer sidebar to compile and audit.");
      return;
    }
    // Set the wizard input to match the founder's input github
    setWizardInput(founderGithub);
    
    // Scroll to terminal/application anchor
    const anchor = document.getElementById("deploy");
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth" });
    }
    
    // Auto-run the wizard process after scroll completes
    setTimeout(() => {
      setWizardActive(true);
      setWizardLogs([]);
      
      const initialLines = [
        `guest@context_window:~$ init_handshake --profile="${founderGithub}" --project="${founderProjName || 'Unlabeled'}"`,
        `[SYS] ESTABLISHING TUNNEL FOR ECOSYSTEM MATCHMAKING...`,
        `[OK] ROUTED PORT FOR ${founderCategory.toUpperCase()} / ${founderBottleneck.toUpperCase()}.`,
        `[SYS] QUERYING GITHUB API TO CONFIRM DENSITY AUDIT...`
      ];

      let delay = 0;
      initialLines.forEach((line) => {
        setTimeout(() => {
          setWizardLogs(prev => [...prev, <div key={Math.random()} style={{ marginBottom: '6px' }}>{line}</div>]);
          if (wizardContainerRef.current) {
            wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
          }
        }, delay);
        delay += 250;
      });

      setTimeout(() => {
        fetch(`https://api.github.com/users/${founderGithub}`)
          .then(res => {
            if (!res.ok) throw new Error("Profile not found");
            return res.json();
          })
          .then(profile => {
            return fetch(`https://api.github.com/users/${founderGithub}/repos?sort=updated&per_page=30`)
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
                  <span className="t-cyan" key="w1">[OK] FOUND PUBLIC BUILDER: {profile.name || founderGithub}</span>,
                  <span key="w2">[ANALYSIS] Repository count: {profile.public_repos}. Top language: {topLang}</span>,
                  <span key="w3">[ANALYSIS] Stargazers metric: {starCount} stars collected.</span>,
                  <span key="w4">[ANALYSIS] Calculated Technical Density: {score}/100.</span>,
                  <span className="t-yellow" key="w5">[SUCCESS] SECURE ENVELOPE ROUTED TO CORE ECOSYSTEM ARCHITECT.</span>,
                  <span key="w6">======================================================</span>,
                  <span className="t-red" style={{ fontWeight: 'bold' }} key="w7">TRANSMISSION RECEIVED // Syed Ateef has queued your application.</span>
                ];
                
                let fDelay = 0;
                finalLines.forEach(node => {
                  setTimeout(() => {
                    setWizardLogs(prev => [...prev, <div key={Math.random()} style={{ marginBottom: '6px' }}>{node}</div>]);
                    if (wizardContainerRef.current) {
                      wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
                    }
                  }, fDelay);
                  fDelay += 300;
                });
              });
          })
          .catch(() => {
            const finalLines = [
              <span key="e1">[WARNING] API RATE LIMITED. BOOTING EMULATED EVALUATOR ENGINE...</span>,
              <span className="t-cyan" key="e2">[OK] FOUND PUBLIC PROFILE: {founderGithub}</span>,
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
                if (wizardContainerRef.current) {
                  wizardContainerRef.current.scrollTop = wizardContainerRef.current.scrollHeight;
                }
              }, fDelay);
              fDelay += 300;
            });
          });
      }, delay + 200);
    }, 600);
  };

  const runPipelineLoop = () => {
    if (isPipelineRunning) return;
    setIsPipelineRunning(true);
    setPipelineStep(0);
    setPipelineLogs(["[SYSTEM] Initiating reasoning loop..."]);
    
    const steps = [
      { log: "[01] Querying vector db for context embeddings...", time: 600 },
      { log: "[02] Found 5 semantic nodes. Re-ranking... OK", time: 1200 },
      { log: "[03] Expanding context window memory space...", time: 1800 },
      { log: "[04] Submitting tokens to model context deck...", time: 2400 },
      { log: "[05] Generating output tokens. Temp: 0.15", time: 3000 },
      { log: "[06] Output safety check validated. Complete.", time: 3600 }
    ];
    
    steps.forEach((step, idx) => {
      setTimeout(() => {
        setPipelineStep(idx);
        setPipelineLogs(prev => [...prev, step.log]);
        if (idx === steps.length - 1) {
          setIsPipelineRunning(false);
        }
      }, step.time);
    });
  };

  const triggerPing = () => {
    const baseLatency = 12;
    const currentJitter = Math.floor(Math.random() * (networkJitter || 10));
    const newPing = {
      id: Date.now(),
      latency: baseLatency + currentJitter,
      jitter: currentJitter
    };
    setPingHistory(prev => {
      const trimmed = prev.length >= 10 ? prev.slice(1) : prev;
      return [...trimmed, newPing];
    });
  };

  const toggleBoostCore = (idx: number) => {
    setBoostedCores(prev => 
      prev.includes(idx) ? prev.filter(c => c !== idx) : [...prev, idx]
    );
  };

  // ---------------------------------------------------------------------------
  // Body Class & Effects Setup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.body.classList.add("wow-body");
    return () => {
      document.body.classList.remove("wow-body");
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

  // Telemetry Interval & Timezone Clocks
  useEffect(() => {
    const getFormattedTime = (date: Date, timeZone: string, label: string) => {
      try {
        return date.toLocaleTimeString("en-US", { 
          hour12: false, 
          timeZone, 
          hour: "2-digit", 
          minute: "2-digit", 
          second: "2-digit" 
        }) + " " + label;
      } catch (e) {
        return date.toLocaleTimeString("en-US", { hour12: false }) + " " + label;
      }
    };

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

  // Terminal scroll handler
  useEffect(() => {
    if (termBodyRef.current) {
      termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }
  }, [termHistory]);

  // Toggle Q&A Row
  const toggleFaq = (idx: number) => {
    setExpandedFaq(prev => (prev === idx ? null : idx));
  };

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
            outputLine = <>active_agents/&nbsp;&nbsp;&nbsp;&nbsp;brain_config.json&nbsp;&nbsp;&nbsp;&nbsp;context_manifesto.txt</>;
            break;
          case 'cat':
            if (args[0] === 'context_manifesto.txt') {
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
                <span className="t-cyan">cat</span>   - View document content (e.g. cat context_manifesto.txt)<br/>
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
                <span className="t-cyan">about</span>              - Detailed info on the Context Window HQ network<br/>
                <span className="t-cyan">nodes</span>              - Output table listing status of all physical nodes<br/>
                <span className="t-cyan">ssh &lt;node_id&gt;</span>       - SSH directly into a resident node (e.g. ssh node_01)<br/>
                <span className="t-cyan">github &lt;username&gt;</span>  - Fetch profile from real GitHub API & calculate density<br/>
                <span className="t-cyan">theme &lt;light|dark|cyber&gt;</span> - Instantly switch landing page design layouts<br/>
                <span className="t-cyan">systemctl</span>          - Check telemetry daemons and compute hardware status<br/>
                <span className="t-cyan">env</span>                - Display environmental variable metrics<br/>
                <span className="t-cyan">ping &lt;host&gt;</span>         - Ping server host and check local latency<br/>
                <span className="t-cyan">clear</span>              - Reset screen history<br/>
                <span className="t-cyan">help</span>               - Output this command instruction matrix
              </>
            );
            break;
          case 'about':
            outputLine = `Context Window HQ is a physical, high-density hacker house and research lab network in Bangalore (HSR Layout Sector 3), SF, Paris, and Tokyo. We cater to emerging AI researchers, systems engineers, and founders building unconventional products and infrastructure. Proof-of-work baseline.`;
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
      `guest@context_window:~$ init_handshake --profile="${username}"`,
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
        <a href="#" className="flex items-center gap-2 hover:opacity-90" style={{ color: "var(--ink-main)", textDecoration: "none", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.2rem", letterSpacing: "-0.03em" }}>
          <div style={{ width: "12px", height: "12px", background: "var(--accent-red)", flexShrink: 0 }}></div>
          <span>CONTEXT_WINDOW // HQ</span>
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
          <p>A physical, high-density hacker house and research lab network built exclusively for emerging researchers, systems engineers, and founders. No VC theatre. Just compute and absolute focus.</p>
          <div className="btn-group">
            <a href="#deploy" className="btn btn-primary">Deploy Yourself ↓</a>
            <a href="#terminal-anchor" className="btn btn-outline">Boot Shell Terminal &gt;_</a>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee" style={{ borderTop: "none" }}>
          <div className="marquee-inner">
            <span>CLUSTER_STATUS: ACTIVE</span>
            <span>ALLOCATION_POOL: 24 H100 GPU NODES</span>
            <span>SYS.LOC: BENGALURU SECTOR 3 [HSR_LAYOUT]</span>
            <span>BACKPLANE_LINK: 10 Gbps // 0% LOSS</span>
            <span>MIDNIGHT_DEMO_LOOP: COMPILING</span>
            <span>CLUSTER_STATUS: ACTIVE</span>
            <span>ALLOCATION_POOL: 24 H100 GPU NODES</span>
            <span>SYS.LOC: BENGALURU SECTOR 3 [HSR_LAYOUT]</span>
            <span>BACKPLANE_LINK: 10 Gbps // 0% LOSS</span>
            <span>MIDNIGHT_DEMO_LOOP: COMPILING</span>
          </div>
        </div>


        {/* THEORY & MANIFESTO */}
        <section id="theory" className="grid-section">
          <div 
            className="grid-cell cell-span-6 reveal bento-tilt"
            onMouseMove={(e) => {
              if (typeof window !== "undefined" && window.innerWidth <= 768) return;
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
              if (typeof window !== "undefined" && window.innerWidth <= 768) return;
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
            <div className="tel-label">Resident Nodes</div>
            <div className="tel-value">03 / 08 Nodes</div>
            <div style={{ fontSize: "10px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>Physically Allocated Slots</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">GPU Cluster Pool</div>
            <div className="tel-value">24x H100 SXM5</div>
            <div style={{ fontSize: "10px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>Dedicated PCIe Gen5 Fabrics</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">Ecosystem Throughput</div>
            <div className="tel-value">72 token/s</div>
            <div style={{ fontSize: "10px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>Avg Local Inference Latency</div>
          </div>
          <div className="tel-card">
            <div className="tel-label">Physical HQ Hub</div>
            <div className="tel-value">BLR_HSR_3</div>
            <div style={{ fontSize: "10px", color: "var(--ink-muted)", fontFamily: "var(--font-code)" }}>High-Density Sandbox Lab</div>
          </div>
        </section>

        {/* [2] RESIDENCY VISUALIZER (MOCK VIDEO VIEWPORT) */}
        <section className="grid-section">
          <div className="grid-cell cell-span-12 reveal">
            <div className="cell-label">System Feed // LIVE_STREAM</div>
            <h2 className="cell-title" style={{ marginBottom: "1.5rem" }}>The Residency Visualizer</h2>
            <p className="cell-body" style={{ maxWidth: "700px", marginBottom: "2rem" }}>
              A look at how we orchestrate compute and founder lifecycles. Configure your project parameters below to simulate your custom 30-day residency roadmap and calculate your resources allocation.
            </p>
            
            <div className="media-window">
              <div className="media-header">
                <div className="media-controls">
                  <div className="terminal-dot" style={{ background: "var(--accent-red)" }}></div>
                  <div className="terminal-dot" style={{ background: "var(--accent-acid)" }}></div>
                  <div className="terminal-dot" style={{ background: "var(--accent-blue)" }}></div>
                </div>
                <div>Residency Interactive Visualizer v2.0.0</div>
                <div style={{ color: "var(--accent-red)", fontWeight: "bold" }}>● ACTIVE MONITOR</div>
              </div>
              <div className="media-screen">
                <div className="viz-container">
                  {/* Sidebar controls */}
                  <div className="viz-sidebar">
                    <button 
                      className={`viz-tab-btn ${vizTab === "founder" ? "active" : ""}`}
                      onClick={() => setVizTab("founder")}
                    >
                      <span>Founder Roadmap</span>
                      <span>[01]</span>
                    </button>
                    <button 
                      className={`viz-tab-btn ${vizTab === "cluster" ? "active" : ""}`}
                      onClick={() => setVizTab("cluster")}
                    >
                      <span>Compute Cluster</span>
                      <span>[02]</span>
                    </button>
                    <button 
                      className={`viz-tab-btn ${vizTab === "pipeline" ? "active" : ""}`}
                      onClick={() => setVizTab("pipeline")}
                    >
                      <span>Inference Pipeline</span>
                      <span>[03]</span>
                    </button>
                    <button 
                      className={`viz-tab-btn ${vizTab === "latency" ? "active" : ""}`}
                      onClick={() => setVizTab("latency")}
                    >
                      <span>Latency Metrics</span>
                      <span>[04]</span>
                    </button>

                    <div style={{ borderTop: "1px dashed var(--border-main)", margin: "0.5rem 0" }}></div>

                    {vizTab === "founder" && (
                      <>
                        <div className="viz-control-group">
                          <label className="viz-control-label">Project Name // Brand name</label>
                          <input 
                            type="text" 
                            className="viz-input"
                            placeholder="e.g. NeuroFlow"
                            value={founderProjName}
                            onChange={(e) => setFounderProjName(e.target.value)}
                          />
                        </div>
                        <div className="viz-control-group">
                          <label className="viz-control-label">Category // Target tech</label>
                          <select 
                            className="viz-select"
                            value={founderCategory}
                            onChange={(e) => setFounderCategory(e.target.value)}
                          >
                            <option value="agentic">Agentic AI</option>
                            <option value="finetune">LLM Fine-tunes</option>
                            <option value="infra">GPU Infra & DevTools</option>
                            <option value="creative">Creative AI / Video</option>
                          </select>
                        </div>
                        <div className="viz-control-group">
                          <label className="viz-control-label">Current Stage // Progress</label>
                          <select 
                            className="viz-select"
                            value={founderStage}
                            onChange={(e) => setFounderStage(e.target.value)}
                          >
                            <option value="idea">Just an Idea</option>
                            <option value="prototype">Working Prototype</option>
                            <option value="live">Live with Users</option>
                            <option value="scaling">Scaling Infrastructure</option>
                          </select>
                        </div>
                        <div className="viz-control-group">
                          <label className="viz-control-label">Main Bottleneck // Needed resource</label>
                          <select 
                            className="viz-select"
                            value={founderBottleneck}
                            onChange={(e) => setFounderBottleneck(e.target.value)}
                          >
                            <option value="compute">Compute & GPUs</option>
                            <option value="funding">Seed & Angel Funding</option>
                            <option value="talent">Co-founder & Talent</option>
                            <option value="mentorship">Expert Feedback</option>
                          </select>
                        </div>
                        <div className="viz-control-group">
                          <label className="viz-control-label">GitHub Username // To audit speed</label>
                          <input 
                            type="text" 
                            className="viz-input"
                            placeholder="e.g. syedateef"
                            value={founderGithub}
                            onChange={(e) => setFounderGithub(e.target.value)}
                          />
                        </div>
                        <button 
                          className="viz-btn" 
                          onClick={compileRoadmap}
                          disabled={isCompilingRoadmap}
                        >
                          {isCompilingRoadmap ? "Compiling..." : "Compile Roadmap"}
                        </button>
                      </>
                    )}

                    {vizTab === "cluster" && (
                      <>
                        <div className="viz-control-group">
                          <div className="viz-control-label">
                            <span>Concurrency</span>
                            <span>{concurrency}%</span>
                          </div>
                          <input 
                            type="range" 
                            className="viz-slider" 
                            min="10" 
                            max="100" 
                            value={concurrency}
                            onChange={(e) => setConcurrency(Number(e.target.value))}
                          />
                        </div>
                        <div className="viz-control-group">
                          <div className="viz-control-label">
                            <span>Thermal Cutoff</span>
                            <span>{thermalLimit}°C</span>
                          </div>
                          <input 
                            type="range" 
                            className="viz-slider" 
                            min="50" 
                            max="95" 
                            value={thermalLimit}
                            onChange={(e) => setThermalLimit(Number(e.target.value))}
                          />
                        </div>
                        <button className="viz-btn" style={{ fontSize: "10px" }} onClick={() => setBoostedCores([])}>
                          Reset Overclocks
                        </button>
                      </>
                    )}

                    {vizTab === "pipeline" && (
                      <>
                        <button 
                          className="viz-btn" 
                          onClick={runPipelineLoop}
                          disabled={isPipelineRunning}
                          style={isPipelineRunning ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                        >
                          {isPipelineRunning ? "Running..." : "Run Pipeline"}
                        </button>
                        <div className="t-gray" style={{ fontSize: "10px", lineHeight: 1.4 }}>
                          Triggers a mock sequential AI planning loop through key systems.
                        </div>
                      </>
                    )}

                    {vizTab === "latency" && (
                      <>
                        <button className="viz-btn" onClick={triggerPing}>
                          Ping Server Node
                        </button>
                        <div className="viz-control-group">
                          <div className="viz-control-label">
                            <span>Network Jitter</span>
                            <span>{networkJitter}ms</span>
                          </div>
                          <input 
                            type="range" 
                            className="viz-slider" 
                            min="5" 
                            max="50" 
                            value={networkJitter}
                            onChange={(e) => setNetworkJitter(Number(e.target.value))}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Main display screen */}
                  <div className="viz-main">
                    {vizTab === "founder" && (
                      <div className="founder-roadmap-view">
                        {!roadmapCompiled && !isCompilingRoadmap ? (
                          <div className="roadmap-idle-state">
                            <div className="terminal-header-mini">[FOUNDER_SIMULATOR_v1.0] // ONBOARDING FLOW</div>
                            <p style={{ fontSize: "12px", color: "var(--ink-muted)", lineHeight: 1.6, margin: "0.5rem 0 1rem 0" }}>
                              Input your startup coordinates in the sidebar to simulate your 30-day residency protocol. 
                              We'll calculate custom H100 compute grants, mentor pairing configurations, and target venture pipelines.
                            </p>
                            <div className="roadmap-step-map">
                              <div className="roadmap-step-card">
                                <span className="step-number">Step 01</span>
                                <span className="step-title">Configure Inputs</span>
                                <span className="step-text">Set your brand name, target tech stack, stage and bottlenecks.</span>
                              </div>
                              <div className="roadmap-step-card">
                                <span className="step-number">Step 02</span>
                                <span className="step-title">Compile Milestones</span>
                                <span className="step-text">Our engine runs parameters to match you with H100 resources & VCs.</span>
                              </div>
                              <div className="roadmap-step-card">
                                <span className="step-number">Step 03</span>
                                <span className="step-title">Commit & Apply</span>
                                <span className="step-text">Scroll to the core recruit shell and launch your handshake check.</span>
                              </div>
                            </div>
                            <span className="blink-text" style={{ fontSize: "10px", color: "var(--accent-acid)", display: "block", marginTop: "1rem", fontWeight: "bold" }}>
                              ● AWAITING PARAMETERS COMPILATION...
                            </span>
                          </div>
                        ) : isCompilingRoadmap ? (
                          <div className="roadmap-compiling-state">
                            <div className="terminal-header-mini">[FOUNDER_SIMULATOR] // COMPILING TELEMETRY</div>
                            <div className="compiling-logs-box">
                              {roadmapLogs.map((log, i) => (
                                <div key={i} className={i === roadmapLogs.length - 1 ? "t-acid font-bold" : "t-gray"}>
                                  {log}
                                </div>
                              ))}
                            </div>
                            <div className="loader-bar-container" style={{ marginTop: "1.5rem" }}>
                              <div className="loader-bar-fill"></div>
                            </div>
                          </div>
                        ) : (
                          <div className="roadmap-display-state">
                            {/* Personal Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-main)", paddingBottom: "10px", marginBottom: "15px" }}>
                              <div>
                                <span style={{ fontSize: "9px", color: "var(--ink-muted)", display: "block" }}>PROJECT INITIALIZED</span>
                                <strong style={{ fontSize: "18px", textTransform: "uppercase", color: "var(--ink-main)" }}>
                                  {founderProjName || "UNLABELED BUILD"}
                                </strong>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "9px", color: "var(--ink-muted)", display: "block" }}>STATUS DECISION</span>
                                <strong style={{ fontSize: "12px", color: "var(--accent-acid)" }}>MATCH VERIFIED</strong>
                              </div>
                            </div>

                            {/* Resource Allocations Grid */}
                            <div className="founder-resource-cards">
                              <div className="founder-res-card">
                                <span className="res-title">Compute Allocation</span>
                                <span className="res-val" style={{ color: "var(--accent-red)" }}>
                                  {founderBottleneck === "compute" ? "8x H100 Dedicated" : "4x H100 Allocated"}
                                </span>
                                <span className="res-sub">+$25k Model Credits</span>
                              </div>
                              <div className="founder-res-card">
                                <span className="res-title">Ecosystem Pairing</span>
                                <span className="res-val" style={{ color: "var(--accent-acid)" }}>
                                  {founderCategory === "infra" ? "Deep Tech VCs" : founderCategory === "agentic" ? "SaaS Angels" : "Media VCs"}
                                </span>
                                <span className="res-sub">Sequoia / Lightspeed</span>
                              </div>
                              <div className="founder-res-card">
                                <span className="res-title">Residency Room Node</span>
                                <span className="res-val" style={{ color: "var(--accent-yellow)" }}>
                                  Node HSR_{founderCategory === "agentic" ? "3A" : "3B"}
                                </span>
                                <span className="res-sub">Sector 3 Co-living</span>
                              </div>
                            </div>

                            {/* Interactive 30-Day Timeline */}
                            <div className="roadmap-timeline-box" style={{ marginTop: "15px" }}>
                              <span style={{ fontSize: "10px", color: "var(--ink-muted)", textTransform: "uppercase", fontWeight: "bold", display: "block", marginBottom: "10px" }}>
                                30-Day Project Milestones // Click weeks to inspect
                              </span>
                              <div className="roadmap-week-tabs">
                                {[
                                  { w: 1, label: "W1: Orientation" },
                                  { w: 2, label: "W2: Midnight Demo" },
                                  { w: 3, label: "W3: VCs Match" },
                                  { w: 4, label: "W4: Launch Day" }
                                ].map((item) => (
                                  <button 
                                    key={item.w}
                                    className={`roadmap-week-btn ${activeRoadmapWeek === item.w ? "active" : ""}`}
                                    onClick={() => setActiveRoadmapWeek(item.w)}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                              <div className="roadmap-week-content" style={{ marginTop: "10px", padding: "10px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-main)", minHeight: "65px", fontSize: "12px", lineHeight: 1.5, textAlign: "left" }}>
                                <strong>Week {activeRoadmapWeek} Focus:</strong>{" "}
                                {(() => {
                                  const milestones = getRoadmapMilestones(founderCategory, founderBottleneck);
                                  if (activeRoadmapWeek === 1) return milestones.week1;
                                  if (activeRoadmapWeek === 2) return milestones.week2;
                                  if (activeRoadmapWeek === 3) return milestones.week3;
                                  return milestones.week4;
                                })()}
                              </div>
                            </div>

                            {/* CTA button */}
                            <div style={{ marginTop: "15px" }}>
                              <button className="viz-btn pulse-button" onClick={commitToMainframe}>
                                Commit Telemetry & Apply to Residency →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {vizTab === "cluster" && (
                      <div className="viz-grid-container">
                        <div className="viz-tab-header">
                          <span>Cluster Map // Active Core Matrix</span>
                          <span style={{ color: "var(--accent-acid)" }}>[NODE_READY]</span>
                        </div>
                        <p className="viz-subtitle">
                          Telemetry showing active local GPU compute clusters in Bangalore HSR. Hover over cores to inspect model active threads; click any cell to simulate a cooling block overclock.
                        </p>
                        <div className="core-grid">
                          {[...Array(64)].map((_, i) => {
                            const isCoreActive = (i * 17 + concurrency * 7) % 100 < concurrency;
                            const coreTemp = 45 + ((i * 3 + thermalLimit) % 25) + (boostedCores.includes(i) ? 25 : 0);
                            let cellClass = "core-cell";
                            if (boostedCores.includes(i)) {
                              cellClass += " boosted-load";
                            } else if (isCoreActive) {
                              cellClass += coreTemp > 65 ? " warm-load" : " active-load";
                            }
                            return (
                              <div 
                                key={i}
                                className={cellClass}
                                onClick={() => toggleBoostCore(i)}
                                onMouseEnter={() => setHoveredCore(i)}
                                onMouseLeave={() => setHoveredCore(null)}
                                style={{
                                  opacity: isCoreActive || boostedCores.includes(i) ? 1 : 0.25
                                }}
                              ></div>
                            );
                          })}
                        </div>

                        {/* Hover Overlay Telemetry */}
                        <div className="viz-monitor-overlay">
                          {hoveredCore !== null ? (
                            <div>
                              <div>[CORE_{String(hoveredCore).padStart(2, '0')}] // PROCESS IDENTIFIED</div>
                              <div style={{ color: boostedCores.includes(hoveredCore) ? "var(--accent-red)" : "var(--accent-acid)", marginTop: "4px" }}>
                                {boostedCores.includes(hoveredCore) ? "BOOSTED: " : ""}
                                {((hoveredCore * 17 + concurrency * 7) % 100 < concurrency) || boostedCores.includes(hoveredCore)
                                  ? CORE_PROCESSES[hoveredCore % CORE_PROCESSES.length] 
                                  : "IDLE_STANDBY"}
                              </div>
                              <div style={{ display: "flex", gap: "1.5rem", marginTop: "4px", opacity: 0.7 }}>
                                <span>Temp: {45 + ((hoveredCore * 3 + thermalLimit) % 25) + (boostedCores.includes(hoveredCore) ? 25 : 0)}°C</span>
                                <span>Load: {boostedCores.includes(hoveredCore) ? "100%" : ((hoveredCore * 17 + concurrency * 7) % 100 < concurrency ? "74%" : "0%")}</span>
                                <span>Click to Overclock</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
                              <div style={{ color: "var(--ink-muted)" }}>[CLUSTER DIAGNOSTICS DECK]</div>
                              <div style={{ fontSize: "10px", marginTop: "4px", opacity: 0.6 }}>Hover over grid cells to read core load threads. Click to boost.</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {vizTab === "pipeline" && (
                      <div className="pipeline-flow">
                        <div className="viz-tab-header">
                          <span>Pipeline Flow // Sequential Inference</span>
                          <span style={{ color: "var(--accent-yellow)" }}>[AWAITING_EXEC]</span>
                        </div>
                        <p className="viz-subtitle">
                          Flowchart tracing token parsing loops. Shows the sequence of embedding lookup, semantic ranking, memory state verification, and model token streaming. Click 'Run Pipeline' in the sidebar to execute.
                        </p>
                        <div className="pipeline-steps">
                          {[
                            "Input",
                            "Search",
                            "Memory",
                            "LLM",
                            "Safety",
                            "Stream"
                          ].map((stepLabel, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="pipeline-step-arrow">&gt;</span>}
                              <div className={`pipeline-step-node ${pipelineStep === idx ? "active" : pipelineStep > idx ? "success" : ""}`}>
                                {stepLabel}
                              </div>
                            </React.Fragment>
                          ))}
                        </div>

                        <div className="pipeline-console">
                          {pipelineLogs.length === 0 ? (
                            <div className="t-gray">Console idle. Press 'Run Pipeline' to compile.</div>
                          ) : (
                            pipelineLogs.map((log, index) => (
                              <div key={index} style={{ marginBottom: "4px" }}>
                                {log}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {vizTab === "latency" && (
                      <div className="latency-container">
                        <div className="viz-tab-header">
                          <span>Latency Graph // Network Topology RTT</span>
                          <span style={{ color: "var(--accent-red)" }}>[DIAGNOSTICS]</span>
                        </div>
                        <p className="viz-subtitle">
                          Diagnostic graph showing round-trip time (RTT) pings from resident devices to global edge API nodes. Toggle jitter limits in the sidebar and click 'Ping Server Node'.
                        </p>
                        <div className="latency-chart">
                          {/* Avg Latency horizontal dotted line */}
                          {(() => {
                            const avg = Math.round(pingHistory.reduce((acc, p) => acc + p.latency, 0) / pingHistory.length);
                            const bottomOffset = Math.min(Math.max((avg / 60) * 100, 10), 90);
                            return (
                              <div 
                                className="latency-avg-indicator"
                                style={{ bottom: `${bottomOffset}%` }}
                              >
                                <span style={{ background: "#050505", color: "var(--accent-red)", fontSize: "8px", padding: "0 4px", fontFamily: "var(--font-code)", position: "absolute", right: "8px", top: "-5px" }}>
                                  AVG: {avg}ms
                                </span>
                              </div>
                            );
                          })()}

                          {pingHistory.map((p, idx) => {
                            const barHeight = Math.min(Math.max((p.latency / 60) * 100, 10), 100);
                            return (
                              <div key={idx} className="latency-bar-wrapper">
                                <div 
                                  className="latency-bar" 
                                  style={{ 
                                    height: `${barHeight}%`,
                                    background: p.latency > 24 ? "var(--accent-red)" : "var(--accent-acid)"
                                  }}
                                ></div>
                                <span className="latency-bar-label">p{idx + 1}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="latency-stats-row">
                          <div className="latency-stat-card">
                            <div className="viz-control-label" style={{ justifyContent: "center" }}>Avg RTT</div>
                            <div className="latency-stat-val">
                              {Math.round(pingHistory.reduce((acc, p) => acc + p.latency, 0) / pingHistory.length)}ms
                            </div>
                          </div>
                          <div className="latency-stat-card">
                            <div className="viz-control-label" style={{ justifyContent: "center" }}>Avg Jitter</div>
                            <div className="latency-stat-val">
                              {(pingHistory.reduce((acc, p) => acc + p.jitter, 0) / pingHistory.length).toFixed(1)}ms
                            </div>
                          </div>
                          <div className="latency-stat-card">
                            <div className="viz-control-label" style={{ justifyContent: "center" }}>Loss</div>
                            <div className="latency-stat-val" style={{ color: "var(--accent-acid)" }}>0.0%</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Shared diagnostics footer */}
                    <div className="viz-telemetry-row">
                      <span>LOAD METRIC: <strong>{(concurrency + (boostedCores.length * 3)).toFixed(1)}%</strong></span>
                      <span>TEMPERATURE: <strong>{(thermalLimit + (boostedCores.length * 0.8)).toFixed(1)}°C</strong></span>
                      <span>THROUGHPUT: <strong>{(1200 + (concurrency * 18) + (boostedCores.length * 150)).toLocaleString()} TOK/S</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROTOCOL BENTO */}
        <section className="grid-section">
          <div className="grid-cell cell-span-12 protocol-header-cell">
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Execution Protocol</h3>
          </div>
          
          <div className="grid-cell cell-span-4 protocol-cell reveal bento-tilt"
               onMouseMove={(e) => {
                 if (typeof window !== "undefined" && window.innerWidth <= 768) return;
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
                 if (typeof window !== "undefined" && window.innerWidth <= 768) return;
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
            <p className="cell-body">A brutal physical residency for hand-selected Founding Engineers. Clock starts day one. Day 30 is a public launch.</p>
            <div className="b-num">02</div>
          </div>
          
          <div className="grid-cell cell-span-4 protocol-cell reveal bento-tilt"
               onMouseMove={(e) => {
                 if (typeof window !== "undefined" && window.innerWidth <= 768) return;
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

        {/* [3] OFFERINGS STACKED FOLDERS */}
        <section className="folder-container reveal">
          <div className="folder-tabs">
            <div 
              className={`folder-tab ${activeFolderTab === "labs" ? "active" : ""}`}
              onClick={() => setActiveFolderTab("labs")}
            >
              [01] Labs Residency
            </div>
            <div 
              className={`folder-tab ${activeFolderTab === "collabs" ? "active" : ""}`}
              onClick={() => setActiveFolderTab("collabs")}
            >
              [02] Market Collabs
            </div>
          </div>
          <div className="folder-body">
            {activeFolderTab === "labs" && (
              <div>
                <h3 className="cell-title">Context Window Labs</h3>
                <p className="cell-body" style={{ fontSize: "16px", maxWidth: "800px" }}>
                  A 30-day physical sprint for developers, hackers, and systems engineers building emerging AI tools, agents, and core infrastructure. We provide accommodation, high-density compute pools, and a zero-distraction environment in HSR Layout Sector 3.
                </p>
                <div style={{ marginTop: "2rem" }}>
                  <strong style={{ color: "var(--accent-red)", fontFamily: "var(--font-code)", textTransform: "uppercase" }}>Environmental Parameters:</strong>
                  <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                    <div className="founder-res-card">
                      <span className="res-title">COMPUTE_RESOURCE</span>
                      <span className="res-val" style={{ color: "var(--accent-acid)" }}>24/7 Uncapped GPU Access</span>
                      <span className="res-sub">Dedicated RTX/H100 compute pools</span>
                    </div>
                    <div className="founder-res-card">
                      <span className="res-title">WORKSPACE_LOGISTICS</span>
                      <span className="res-val" style={{ color: "var(--accent-red)" }}>Fully Subsidized Accommodation</span>
                      <span className="res-sub">Sector 3 HSR physical room node</span>
                    </div>
                    <div className="founder-res-card" style={{ gridColumn: "span 2" }}>
                      <span className="res-title">COHORT_DENSITY</span>
                      <span className="res-val" style={{ color: "var(--accent-blue)" }}>Elite Hacker Group</span>
                      <span className="res-sub">Zero-friction distraction-free dev sprint</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeFolderTab === "collabs" && (
              <div>
                <h3 className="cell-title">Investor & Founder Collaborations</h3>
                <p className="cell-body" style={{ fontSize: "16px", maxWidth: "800px" }}>
                  We bridge the gap between building prototype code and shipping scaling ventures. Once you register, we collaborate directly to put your builds in front of top-tier investors, active founders, and experienced market players.
                </p>
                <div style={{ marginTop: "2rem" }}>
                  <strong style={{ color: "var(--accent-acid)", fontFamily: "var(--font-code)", textTransform: "uppercase" }}>Collaboration Nodes:</strong>
                  <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                    <div className="founder-res-card">
                      <span className="res-title">FEEDBACK_PIPELINE</span>
                      <span className="res-val" style={{ color: "var(--accent-acid)" }}>Direct Founder Review Loops</span>
                      <span className="res-sub">Midnight demo critique from veteran builders</span>
                    </div>
                    <div className="founder-res-card">
                      <span className="res-title">CAPITAL_MATCHMAKING</span>
                      <span className="res-val" style={{ color: "var(--accent-red)" }}>Warm VC Introduced Nodes</span>
                      <span className="res-sub">Immediate pipelines to leading Seed & Angel funds</span>
                    </div>
                    <div className="founder-res-card" style={{ gridColumn: "span 2" }}>
                      <span className="res-title">ECOSYSTEM_INTEGRATION</span>
                      <span className="res-val" style={{ color: "var(--accent-blue)" }}>Veteran Tech Network Collab</span>
                      <span className="res-sub">Strategic pairing with experienced market players</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>


        {/* [5] ALUMNI TESTIMONIALS */}
        <section className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderBottom: "1px solid var(--border-main)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Alumni Telemetry</h3>
        </section>

        <section className="testimonials-grid reveal">
          <div className="testimonial-card">
            <p className="testimonial-quote">
              "Building together at Context Window felt like shifting from 100ms latency to 1ms. The feedback loop is unmatched."
            </p>
            <div className="testimonial-author">
              <span className="testimonial-name">Dev Mandal</span>
              <span className="testimonial-role">Resident // Agentic Devs</span>
            </div>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-quote">
              "We shipped our core engine in two weeks here. The visual styling is nice but the focus is what keeps you."
            </p>
            <div className="testimonial-author">
              <span className="testimonial-name">Shourya</span>
              <span className="testimonial-role">Resident // Video Gen</span>
            </div>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-quote">
              "The best physical space for builders in India. Pure high-density code, no VC fluff."
            </p>
            <div className="testimonial-author">
              <span className="testimonial-name">Sushanth & Shubham</span>
              <span className="testimonial-role">Founders // Infra-as-code</span>
            </div>
          </div>
        </section>

        {/* [6] PUBLICATIONS SECTION */}
        <section className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderBottom: "1px solid var(--border-main)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Technical Publications</h3>
        </section>

        <section className="publications-grid reveal">
          <a href="#" className="publication-card" onClick={(e) => e.preventDefault()}>
            <div>
              <div className="pub-meta">
                <span>ESSAY</span>
                <span>7 min read</span>
              </div>
              <h4 className="pub-title">Optimizing Latency In Locally Hosted Quantized LLM Inference Pipelines</h4>
              <p className="pub-excerpt">
                A deep architectural deep-dive into quantization parameters, VMM execution mappings, and WebGPU tensor scaling.
              </p>
            </div>
            <span className="pub-link">Read Essay →</span>
          </a>
          <a href="#" className="publication-card" onClick={(e) => e.preventDefault()}>
            <div>
              <div className="pub-meta">
                <span>CASE STUDY</span>
                <span>5 min read</span>
              </div>
              <h4 className="pub-title">State Synchronization Fallbacks Across Edge-Computed Multi-Agent Orchestrations</h4>
              <p className="pub-excerpt">
                Analyzing state consensus blocks, conflict-free replicated data types (CRDTs), and peer-to-peer network recovery rules.
              </p>
            </div>
            <span className="pub-link">Read Essay →</span>
          </a>
          <a href="#" className="publication-card" onClick={(e) => e.preventDefault()}>
            <div>
              <div className="pub-meta">
                <span>RESEARCH</span>
                <span>12 min read</span>
              </div>
              <h4 className="pub-title">Bypassing Context Window Exhaustion in High-Frequency Technical Logging</h4>
              <p className="pub-excerpt">
                Exploring dynamic sliding attention windows, memory offloading, and streaming garbage collection behaviors.
              </p>
            </div>
            <span className="pub-link">Read Essay →</span>
          </a>
        </section>

        {/* NETWORK TOPOLOGY */}
        <div className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)" }}>
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
              <div>CONTEXT_WINDOW_HQ // SHELL v1.2.0</div>
              <div style={{ opacity: 0.6 }}>BLR_IN</div>
            </div>
            <div className="terminal-body" ref={termBodyRef} onClick={() => document.getElementById('term-input')?.focus()}>
              <div className="t-gray"># Context Window HQ Shell Console.</div>
              <div className="t-gray"># Rebranded matching official parameters. Built for rapid technical indexing.</div>
              <div className="t-gray">
                # Commands: <span className="t-yellow">help</span>, <span className="t-yellow">about</span>, <span className="t-yellow">nodes</span>, <span className="t-yellow">github &lt;username&gt;</span>, <span className="t-yellow">ssh &lt;node&gt;</span>, <span className="t-yellow">theme &lt;mode&gt;</span>, <span className="t-yellow">systemctl</span>, <span className="t-yellow">env</span>, <span className="t-yellow">ping</span>, <span className="t-yellow">clear</span>
              </div>
              <br/>
              <div><span className="t-cyan">guest@context_window:~$</span> <span className="t-yellow">about</span></div>
              <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>Context Window HQ is a physical, high-density hacker house and research lab network in Bangalore (HSR Layout Sector 3), SF, Paris, and Tokyo. We cater to emerging AI researchers, systems engineers, and founders building unconventional products and infrastructure.</div>
              
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
          <div className="grid-cell cell-span-12 reveal" style={{ paddingBottom: "2rem", borderBottom: "1px solid var(--border-main)" }}>
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

        {/* [7] INTERACTIVE FAQS ACCORDION */}
        <section className="faq-section reveal">
          <div className="grid-cell cell-span-12" style={{ padding: "2rem 4rem", background: "var(--bg-base)", borderBottom: "1px solid var(--border-main)" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 800, textTransform: "uppercase" }}>Frequently Asked Questions</h3>
          </div>
          
          <div className="faq-row">
            <div className="faq-question" onClick={() => toggleFaq(0)}>
              <span className="faq-title">What is Context Window HQ?</span>
              <span className="faq-icon">{expandedFaq === 0 ? "[-]" : "[+]"}</span>
            </div>
            {expandedFaq === 0 && (
              <div className="faq-answer">
                Context Window HQ is a physical, high-density hacker house and research lab network. We build and curate environments designed exclusively for emerging systems engineers, artists, and founders who need high-performance compute and focus.
              </div>
            )}
          </div>

          <div className="faq-row">
            <div className="faq-question" onClick={() => toggleFaq(1)}>
              <span className="faq-title">Who is this residency for?</span>
              <span className="faq-icon">{expandedFaq === 1 ? "[-]" : "[+]"}</span>
            </div>
            {expandedFaq === 1 && (
              <div className="faq-answer">
                We look for builders with high technical density. People who ship open-source repos, build compilers, train video generation pipelines, or orchestrate high-load server meshes. We bypass credentials like university titles and look strictly for proof-of-work.
              </div>
            )}
          </div>

          <div className="faq-row">
            <div className="faq-question" onClick={() => toggleFaq(2)}>
              <span className="faq-title">How long is the residency cycle?</span>
              <span className="faq-icon">{expandedFaq === 2 ? "[-]" : "[+]"}</span>
            </div>
            {expandedFaq === 2 && (
              <div className="faq-answer">
                Residency cycles are typically 30 days of physical workspace and co-living access. At the end of the 30 days, we host a public launch event where you present your architecture and live demos to the builder ecosystem.
              </div>
            )}
          </div>

          <div className="faq-row">
            <div className="faq-question" onClick={() => toggleFaq(3)}>
              <span className="faq-title">Is there equity taken or a fee to apply?</span>
              <span className="faq-icon">{expandedFaq === 3 ? "[-]" : "[+]"}</span>
            </div>
            {expandedFaq === 3 && (
              <div className="faq-answer">
                No. Context Window HQ takes zero equity and there is no cost to join or apply. The house is funded by strategic infrastructure partners (cloud providers, database platforms) who want to put their compute in the hands of elite builders.
              </div>
            )}
          </div>
        </section>

        {/* [8] FOOTER CTA & NEWSLETTER / ONBOARDING WIZARD */}
        <section id="deploy" className="grid-section">
          <div className="footer-action reveal">
            <div className="footer-content">
              <h2>Prove Your<br/>Technical Density</h2>
              <p>Drop your GitHub username or a live deployment link. No cover letters. Syed Ateef will review the architecture directly.</p>
              
              <div className="application-box" style={{ background: '#070709', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8)', overflow: 'hidden' }}>
                {!wizardActive ? (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#070709', padding: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-code)', fontSize: '13px', color: 'var(--accent-acid)', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      guest@context_window:~$ init_handshake --user=
                    </span>
                    <input 
                      type="text" 
                      placeholder="github_username"
                      value={wizardInput}
                      onChange={(e) => setWizardInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') runWizard(); }}
                      style={{ flex: 1, minWidth: '150px', background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontFamily: 'var(--font-code)', fontSize: '13px', padding: '4px 0' }}
                    />
                    <button 
                      onClick={runWizard} 
                      className="btn btn-outline" 
                      style={{ 
                        padding: '0.6rem 1.2rem', 
                        fontSize: '11px', 
                        fontFamily: 'var(--font-code)', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.08em', 
                        cursor: 'pointer',
                        borderColor: 'rgba(255, 255, 255, 0.25)',
                        borderWidth: '1px'
                      }}
                    >
                      RUN_HANDSHAKE &gt;_
                    </button>
                  </div>
                ) : (
                  <div className="app-cli-output" style={{ display: 'block', background: '#070709', borderTop: 'none' }} ref={wizardContainerRef}>
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
