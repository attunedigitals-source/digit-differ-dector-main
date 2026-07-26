import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  PlayCircle,
  Settings2,
  ShieldCheck,
  UserPlus,
  Zap,
  Sparkles,
  MousePointerClick,
  Sliders,
  Power,
  Calculator,
  Layers,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "access", title: "1. Landing & Login Access" },
  { id: "client-portal", title: "2. Client Portal & Deriv Connect" },
  { id: "disconnected-engine", title: "3. AI Engine Setup & Manual Risk" },
  { id: "connected-auto-generate", title: "4. Account Balances & Auto Generate" },
  { id: "best-practices", title: "Best Practices" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const highlights = [
  {
    title: "AI-Automation Engine",
    description: "Executes disciplined digit-differ strategies on synthetic indices with built-in volatility tracking.",
    icon: Zap,
  },
  {
    title: "OAuth 2.0 PKCE Security",
    description: "Connect securely with official Deriv credentials without sharing your trading password.",
    icon: KeyRound,
  },
  {
    title: "Auto Generate Risk Rules",
    description: "Instantly auto-calculate optimal Base Stake, Allow Loss, and Target Profit based on live account balance.",
    icon: Calculator,
  },
];

interface CalloutTarget {
  badge: number;
  title: string;
  description: string;
  xPercent: number; // percentage left on image
  yPercent: number; // percentage top on image
  arrowTargetX?: number; // target point for SVG arrow
  arrowTargetY?: number;
}

const ImageWithAnnotations = ({
  src,
  alt,
  callouts,
}: {
  src: string;
  alt: string;
  callouts: CalloutTarget[];
}) => {
  return (
    <div className="space-y-6">
      {/* Annotated Screenshot Container */}
      <div className="relative rounded-3xl overflow-hidden border border-primary/30 bg-card shadow-2xl transition-transform hover:scale-[1.005] duration-300">
        <img src={src} alt={alt} className="w-full h-auto block select-none" />

        {/* SVG Arrow Overlay Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            <marker
              id="arrow-head-primary"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
            </marker>
          </defs>
          {callouts.map((c) => {
            if (c.arrowTargetX === undefined || c.arrowTargetY === undefined) return null;
            return (
              <g key={`arrow-${c.badge}`}>
                {/* Curve or Straight Pointer Line */}
                <line
                  x1={`${c.xPercent}%`}
                  y1={`${c.yPercent}%`}
                  x2={`${c.arrowTargetX}%`}
                  y2={`${c.arrowTargetY}%`}
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  markerEnd="url(#arrow-head-primary)"
                  className="animate-pulse"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Pulsing Badge Markers */}
        {callouts.map((c) => (
          <div
            key={`marker-${c.badge}`}
            style={{ top: `${c.yPercent}%`, left: `${c.xPercent}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute -inset-1 rounded-full bg-primary/60 blur-sm animate-ping" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-sm shadow-xl ring-2 ring-background border border-emerald-300">
                {c.badge}
              </div>
            </div>

            {/* Hover Tooltip Preview */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border border-border z-30 pointer-events-none">
              <p className="font-bold text-primary">{c.title}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{c.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Explanatory Legend Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {callouts.map((c) => (
          <div
            key={`legend-${c.badge}`}
            className="flex items-start gap-3 p-3.5 bg-background/60 rounded-xl border border-border/80 hover:border-primary/40 transition-colors shadow-sm"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow">
              {c.badge}
            </div>
            <div>
              <h5 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {c.title}
              </h5>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {c.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pb-20">
      {/* Dynamic Background Effects */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Navigation Bar */}
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between max-w-7xl">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Digit Bot <span className="text-primary">Pro</span></p>
              <p className="text-xs text-muted-foreground">User Manual & Interactive Guide</p>
            </div>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="border-border bg-secondary/40">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button asChild className="font-semibold shadow-lg shadow-primary/20">
              <Link to="/auth?signup=true">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 md:py-14 max-w-7xl">
        {/* Overview Header Section */}
        <section id="overview" className="mb-16 overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-secondary/80 via-card to-background p-8 shadow-2xl md:p-12">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> Updated Interface Guide & Visual Walkthrough
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Master Digit Bot Pro from setup to live execution.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              This official guide outlines the complete workflow for Digit Bot Pro, including Client Portal sign-in, Deriv account synchronization, and the automated <strong>Auto Generate</strong> risk calculation engine.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border/80 bg-background/60 backdrop-blur-md rounded-2xl hover:border-primary/50 transition-all duration-300">
                  <CardContent className="p-6">
                    <Icon className="mb-4 h-8 w-8 text-primary" />
                    <h3 className="mb-2 font-bold text-lg">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[280px_1fr]">
          {/* Sticky Sidebar Navigation */}
          <aside className="h-fit rounded-2xl border border-border bg-card/80 p-6 shadow-xl lg:sticky lg:top-32 hidden lg:block">
            <h2 className="mb-6 flex items-center gap-2 font-bold text-lg">
              <BookOpen className="h-5 w-5 text-primary" /> Documentation
            </h2>
            <nav className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:translate-x-1"
                >
                  {section.title}
                </a>
              ))}
            </nav>

            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Need Support?</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Join our VIP WhatsApp or Telegram for instant assistance.</p>
              <a href="https://t.me/DigitBotPro" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                Contact Technical Support <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </aside>

          {/* Main Documentation Walkthrough */}
          <div className="space-y-24">
            
            {/* 1. Landing & Login Access */}
            <section id="access" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">1. Access Digit Bot Pro & Sign In</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  Navigate to <strong className="text-foreground">Digit Bot Pro</strong>. You can register a new account or sign in to your Client Portal from the home page.
                </p>

                {/* Step 1 Image 1: Landing Page */}
                <div className="mb-10 space-y-4">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Step 1A: Home Page Header Navigation
                  </h3>
                  <ImageWithAnnotations
                    src="/doc-step-1-landing.png"
                    alt="Digit Bot Pro Home Page Header"
                    callouts={[
                      {
                        badge: 1,
                        title: "Navigation & Actions",
                        description: "Access Features, How it Works, Security, or click Login / Register.",
                        xPercent: 88,
                        yPercent: 38,
                        arrowTargetX: 86,
                        arrowTargetY: 42,
                      },
                      {
                        badge: 2,
                        title: "Predictive Automation Engine",
                        description: "Welcome banner introducing the ensemble automation engine.",
                        xPercent: 50,
                        yPercent: 65,
                      },
                    ]}
                  />
                </div>

                {/* Step 1 Image 2: Client Portal Login */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <LockKeyhole className="h-5 w-5 text-primary" /> Step 1B: Client Portal Login Page
                  </h3>
                  <ImageWithAnnotations
                    src="/doc-step-2-login.png"
                    alt="Client Portal Sign In Form"
                    callouts={[
                      {
                        badge: 1,
                        title: "Credentials Input",
                        description: "Enter your registered Email Address and Password.",
                        xPercent: 50,
                        yPercent: 52,
                        arrowTargetX: 48,
                        arrowTargetY: 58,
                      },
                      {
                        badge: 2,
                        title: "Client Portal Login Button",
                        description: "Click to submit credentials and enter your personal portal.",
                        xPercent: 50,
                        yPercent: 78,
                        arrowTargetX: 50,
                        arrowTargetY: 82,
                      },
                    ]}
                  />
                </div>
              </div>
            </section>

            {/* 2. Client Portal & Deriv Connect */}
            <section id="client-portal" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CircleDollarSign className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">2. Client Portal & Deriv Connection</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  Once logged into your Client Portal, authenticate your active Deriv trading account securely via OAuth 2.0.
                </p>

                <ImageWithAnnotations
                  src="/doc-step-3-portal.png"
                  alt="Client Portal Welcome & Deriv Connect"
                  callouts={[
                    {
                      badge: 1,
                      title: "Connect to Deriv Action",
                      description: "Click green 'Connect to Deriv ->' button to link your live or demo Deriv account.",
                      xPercent: 33,
                      yPercent: 86,
                      arrowTargetX: 33,
                      arrowTargetY: 90,
                    },
                    {
                      badge: 2,
                      title: "VIP WhatsApp Community",
                      description: "Join our active WhatsApp group for direct admin support & signal updates.",
                      xPercent: 67,
                      yPercent: 86,
                      arrowTargetX: 67,
                      arrowTargetY: 90,
                    },
                  ]}
                />

                <div className="mt-8 grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      <strong>OAuth 2.0 PKCE Security:</strong> Your Deriv trading credentials remain strictly private. Automation only uses official API tokens generated directly from Deriv.
                    </p>
                  </div>
                  <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex gap-3">
                    <MessageSquare className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      <strong>Community Support:</strong> Access real-time community insights and admin announcements inside the VIP WhatsApp group.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. AI Engine Setup & Manual Risk */}
            <section id="disconnected-engine" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Sliders className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">3. Digits AI Engine & Manual Parameters</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  Before or after connecting, you can set your initial trading parameters, initial balance, base stake, and cooldown intervals.
                </p>

                <ImageWithAnnotations
                  src="/doc-step-4-disconnected.png"
                  alt="Digits AI Engine Disconnected Interface"
                  callouts={[
                    {
                      badge: 1,
                      title: "START Power Button",
                      description: "Click START to initiate Deriv connection and fetch live account balances.",
                      xPercent: 85,
                      yPercent: 21,
                      arrowTargetX: 85,
                      arrowTargetY: 26,
                    },
                    {
                      badge: 2,
                      title: "Init Balance & Auto Generate",
                      description: "Type your initial capital and click 'Auto Generate' to automatically set risk parameters.",
                      xPercent: 75,
                      yPercent: 51,
                      arrowTargetX: 75,
                      arrowTargetY: 54,
                    },
                    {
                      badge: 3,
                      title: "Base Stake Input",
                      description: "Base stake amount for standard trades (e.g. 0.35 or auto-generated).",
                      xPercent: 50,
                      yPercent: 63,
                      arrowTargetX: 50,
                      arrowTargetY: 67,
                    },
                    {
                      badge: 4,
                      title: "Allow Loss & Target Profit",
                      description: "Risk boundaries to automatically stop trading upon reaching limits.",
                      xPercent: 50,
                      yPercent: 73,
                      arrowTargetX: 50,
                      arrowTargetY: 77,
                    },
                    {
                      badge: 5,
                      title: "Cooldown Interval",
                      description: "Configure automated pauses (e.g. 60 min) between trading sequences.",
                      xPercent: 50,
                      yPercent: 83,
                      arrowTargetX: 50,
                      arrowTargetY: 87,
                    },
                  ]}
                />
              </div>
            </section>

            {/* 4. Connected Trading, Balances & Auto Generate Calculation */}
            <section id="connected-auto-generate" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">4. Live Balances & Auto Generate Engine</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  When connected, the engine fetches your active Deriv accounts (Real & Demo) and populates your balance automatically.
                </p>

                <ImageWithAnnotations
                  src="/doc-step-5-connected.png"
                  alt="Digits AI Engine Connected Interface"
                  callouts={[
                    {
                      badge: 1,
                      title: "Account Balances Switcher",
                      description: "Switch seamlessly between Real and Demo accounts with live USD balance updates.",
                      xPercent: 50,
                      yPercent: 44,
                      arrowTargetX: 50,
                      arrowTargetY: 48,
                    },
                    {
                      badge: 2,
                      title: "CONNECTED Status Badge",
                      description: "Green indicator confirming real-time WebSocket connection to Deriv.",
                      xPercent: 80,
                      yPercent: 62,
                      arrowTargetX: 80,
                      arrowTargetY: 66,
                    },
                    {
                      badge: 3,
                      title: "Auto Generate Button",
                      description: "Populates Base Stake, Allow Loss, & Target Profit according to mathematical rules.",
                      xPercent: 75,
                      yPercent: 70,
                      arrowTargetX: 75,
                      arrowTargetY: 74,
                    },
                    {
                      badge: 4,
                      title: "STOP Power Button",
                      description: "Click red STOP to instantly pause automation and disconnect.",
                      xPercent: 85,
                      yPercent: 21,
                      arrowTargetX: 85,
                      arrowTargetY: 26,
                    },
                  ]}
                />

                {/* Mathematical Auto Generate Rules Card */}
                <div className="mt-10 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-background to-secondary/30 p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                      <Calculator className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Auto Generate Calculation Rules</h3>
                      <p className="text-xs text-muted-foreground">Standardized mathematical risk management formulas</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Rule 1 */}
                    <div className="p-5 bg-background/80 rounded-2xl border border-border shadow-sm space-y-3">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 px-3 py-1 font-bold">
                        Condition 1: Init Balance between $500 and $1,000
                      </Badge>
                      <ul className="space-y-2 text-sm text-muted-foreground pt-1">
                        <li className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="font-semibold text-foreground">BASE STAKE:</span>
                          <span className="font-mono text-primary font-bold">$1.00</span>
                        </li>
                        <li className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="font-semibold text-foreground">ALLOW LOSS:</span>
                          <span className="font-mono text-rose-400 font-bold">$200.00</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="font-semibold text-foreground">TARGET PROFIT:</span>
                          <span className="font-mono text-emerald-400 font-bold">$120.00</span>
                        </li>
                      </ul>
                    </div>

                    {/* Rule 2 */}
                    <div className="p-5 bg-background/80 rounded-2xl border border-border shadow-sm space-y-3">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1 font-bold">
                        Condition 2: Init Balance greater than $1,000
                      </Badge>
                      <ul className="space-y-2 text-sm text-muted-foreground pt-1">
                        <li className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="font-semibold text-foreground">ALLOW LOSS:</span>
                          <span className="font-mono text-rose-400 font-bold">INIT BALANCE / 5</span>
                        </li>
                        <li className="flex justify-between border-b border-border/40 pb-1.5">
                          <span className="font-semibold text-foreground">BASE STAKE:</span>
                          <span className="font-mono text-primary font-bold">ALLOW LOSS / 285.714</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="font-semibold text-foreground">TARGET PROFIT:</span>
                          <span className="font-mono text-emerald-400 font-bold">ALLOW LOSS * 0.6</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Manual Override Available:</strong> Users can click <strong>Manual</strong> at any time to freely adjust Base Stake, Allow Loss, or Target Profit parameters.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="scroll-mt-32">
              <div className="bg-secondary/10 p-8 md:p-12 rounded-[2.5rem] border border-border">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                  <ShieldCheck className="h-8 w-8 text-primary" /> Best Practices for Risk Safety
                </h2>
                <div className="grid gap-4">
                  {[
                    "Always start testing on a Demo account before automating live funds.",
                    "Use the Auto Generate button to automatically calculate mathematically optimal risk limits.",
                    "Ensure a stable internet connection for real-time WebSocket tick signals.",
                    "Set appropriate Cooldown Intervals (30–60 minutes) to prevent over-trading.",
                    "Monitor session profit and loss regularly and stop when Target Profit is achieved."
                  ].map((practice, i) => (
                    <div key={i} className="flex gap-4 items-start p-4 bg-background/50 rounded-2xl border border-border/50">
                      <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                      <p className="text-muted-foreground font-medium">{practice}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="scroll-mt-32">
              <div className="bg-card p-8 md:p-12 rounded-[2.5rem] border border-border shadow-inner">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                  <LifeBuoy className="h-8 w-8 text-primary" /> Troubleshooting & Support
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Connection Issues</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      If status shows DISCONNECTED, click the green <strong>START</strong> button at the top right to re-authorize with Deriv.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Account Balances Not Fetching</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Ensure your Deriv account token is valid. If balance fails to show, log out of Client Portal and sign in again.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Auto Generate Not Editing</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      When Auto Generate is active, parameters are locked to prevent accidental changes. Click <strong>Manual</strong> to unlock inputs.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Automatic Stop Triggered</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      The engine automatically pauses if Target Profit or Allow Loss limit is reached to protect your capital.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer Support Callout */}
      <footer className="container mx-auto px-6 py-12 max-w-7xl">
        <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-[2.5rem] p-8 md:p-16 text-center text-primary-foreground shadow-2xl shadow-primary/30">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Need Further Assistance?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">Our official support channel is ready to assist with account connection or automation queries.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold px-10 rounded-2xl h-16 text-lg">
              <a href="https://t.me/DigitBotPro" target="_blank" rel="noopener noreferrer">Join Telegram Support</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-bold px-10 rounded-2xl h-16 text-lg">
              <Link to="/">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Documentation;
