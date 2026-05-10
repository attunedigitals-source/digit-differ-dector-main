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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "access", title: "1. Access Digit Bot Pro" },
  { id: "fetch-balances", title: "2. Select account & Fetch Balance" },
  { id: "configure-ai", title: "3. Configure & Start AI" },
  { id: "wind-down", title: "4. Graceful Exit: Wind Down" },
  { id: "best-practices", title: "Best Practices" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const highlights = [
  {
    title: "AI-Trading Engine",
    description: "Harnesses predictive intelligence to execute disciplined digit-based strategies on synthetic indices.",
    icon: Zap,
  },
  {
    title: "Secure Connection",
    description: "Connect safely using the official Deriv login. We prioritize security and only require basic trading permissions.",
    icon: KeyRound,
  },
  {
    title: "Built-in Risk Controls",
    description: "Use daily limits, profit targets, and 'Wind Down' features to protect your capital and reduce emotional trading.",
    icon: ShieldCheck,
  },
];

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 pb-20">
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Hero Header */}
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between max-w-7xl">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Digit Bot <span className="text-primary">Pro</span></p>
              <p className="text-xs text-muted-foreground">Documentation & Setup Guide</p>
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
        {/* Overview Section */}
        <section id="overview" className="mb-16 overflow-hidden rounded-[2.5rem] border border-border bg-gradient-to-br from-secondary/80 via-card to-background p-8 shadow-2xl md:p-12">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> Comprehensive Visual Walkthrough
            </div>
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              Master Digit Bot Pro from setup to execution.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Digit Bot Pro is an advanced trading tool for Deriv synthetic indices. This guide provides step-by-step visual instructions to ensure your automation is configured for maximum discipline and capital safety.
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

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[300px_1fr]">
          {/* Sidebar Navigation */}
          <aside className="h-fit rounded-2xl border border-border bg-card/80 p-6 shadow-xl lg:sticky lg:top-32 hidden lg:block">
            <h2 className="mb-6 flex items-center gap-2 font-bold text-lg">
              <BookOpen className="h-5 w-5 text-primary" /> Guide Sections
            </h2>
            <nav className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary hover:translate-x-1"
                >
                  {section.title}
                </a>
              ))}
            </nav>

            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Need Support?</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Our team is available on Telegram for technical assistance.</p>
              <a href="https://t.me/DigitBotPro" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                Contact via Telegram <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="space-y-24">
            
            {/* 1. Access Digit Bot Pro */}
            <section id="access" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">1. Access Digit Bot Pro & Redirect</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  You can access Deriv by using any of the options below. Both options will take you to Deriv for login or account creation.
                </p>
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start p-4 bg-background/50 rounded-2xl border border-border/50">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                      <p className="text-muted-foreground">Click <strong>"Launch Tool"</strong> to go to Deriv and start trading.</p>
                    </div>
                    <div className="flex gap-4 items-start p-4 bg-background/50 rounded-2xl border border-border/50">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                      <p className="text-muted-foreground">Click <strong>"Login"</strong> (top right) to go to Deriv.</p>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex gap-3">
                      <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground"><strong>Tip:</strong> You can login or create a new account on Deriv when you click "Launch Tool" or "Login".</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3 items-center text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Redirected to Deriv for secure login</span>
                    </div>
                    <div className="flex gap-3 items-center text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Login if you already have an account</span>
                    </div>
                    <div className="flex gap-3 items-center text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Create a new account if you're new</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500 mb-8">
                  <img src="/doc-step-1-access.png" alt="Access Digit Bot Pro" className="w-full h-auto" />
                </div>
                <div className="bg-secondary/10 p-6 rounded-2xl border border-border">
                  <p className="text-sm text-muted-foreground">
                    <strong>Secure & Seamless:</strong> Your Deriv account is secure. Digit Bot Pro only accesses your account with the secure permissions you grant through Deriv.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Select account to trade & Fetch account Balance */}
            <section id="fetch-balances" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CircleDollarSign className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">2. Select account to trade & Fetch account Balance</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">
                  Before you begin trading, you must select the correct account and connect to Deriv. 
                  <span className="block mt-2 text-primary font-semibold italic">Important: New users should always start with a Demo account to familiarize themselves with the engine.</span>
                </p>
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="p-4 bg-background/50 rounded-2xl border border-border/50 text-center">
                    <p className="font-bold text-primary mb-1">Step 1</p>
                    <p className="text-sm text-muted-foreground">Open the Digit Bot Pro dashboard.</p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-2xl border border-border/50 text-center">
                    <p className="font-bold text-primary mb-1">Step 2</p>
                    <p className="text-sm text-muted-foreground">Select your <strong>Demo</strong> or Real account from the switcher.</p>
                  </div>
                  <div className="p-4 bg-background/50 rounded-2xl border border-border/50 text-center">
                    <p className="font-bold text-primary mb-1">Step 3</p>
                    <p className="text-sm text-muted-foreground">Click the green <strong>START</strong> button at the top right.</p>
                  </div>
                </div>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500 mb-8">
                  <img src="/doc-step-select-account.png" alt="Select account & Fetch Balance" className="w-full h-auto" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">Your balances and performance data will appear after you connect.</p>
                  </div>
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">Switch between accounts easily using the top navigation switcher.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Configure AI Engine */}
            <section id="configure-ai" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">3. Verify & Configure AI Engine</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">Once connected, verify your balance and configure the engine settings for your trading session.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500 mb-8">
                  <img src="/doc-step-3-configure.png" alt="Configure AI Engine" className="w-full h-auto" />
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg">1. Verify Connection</h4>
                    <ul className="space-y-3">
                      <li className="flex gap-3 items-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Status changes to <strong>CONNECTED</strong></span>
                      </li>
                      <li className="flex gap-3 items-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Account balances displayed automatically</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg">2. Configure Settings</h4>
                    <ul className="space-y-3">
                      <li className="flex gap-3 items-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Set Base Stake & Max Step</span>
                      </li>
                      <li className="flex gap-3 items-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Adjust Cooldown Intervals</span>
                      </li>
                      <li className="flex gap-3 items-center text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        <span>Start the AI Trading Loop</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Graceful Exit: Wind Down */}
            <section id="wind-down" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <LockKeyhole className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-warning">4. Graceful Exit: Wind Down</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">Let your bot finish strong. The bot will continue trading until the next profitable exit, then stop safely.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500 mb-8">
                  <img src="/doc-step-4-wind-down.png" alt="Wind Down Feature" className="w-full h-auto" />
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg">Smart Exit Control</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Locate the <strong>"WIND DOWN ON NEXT PROFIT"</strong> button at the bottom of the Digits AI Engine panel. This ensures no abrupt stops or open trade interruptions.
                    </p>
                    <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                      <p className="text-sm text-amber-600 font-bold">Important:</p>
                      <p className="text-xs text-muted-foreground mt-1">Monitor your session and use this feature when you want to end trading on a profit-led exit.</p>
                    </div>
                  </div>
                  <div className="space-y-4 p-6 bg-secondary/10 rounded-3xl border border-border">
                    <h4 className="font-bold text-lg">How it works:</h4>
                    <ol className="space-y-4">
                      <li className="flex gap-4">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">1</div>
                        <p className="text-sm text-muted-foreground">The bot keeps trading as usual after activation.</p>
                      </li>
                      <li className="flex gap-4">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs font-bold">2</div>
                        <p className="text-sm text-muted-foreground">When the next profitable trade closes, the bot stops safely.</p>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </section>

            {/* Best Practices */}
            <section id="best-practices" className="scroll-mt-32">
              <div className="bg-secondary/10 p-8 md:p-12 rounded-[2.5rem] border border-border">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                  <ShieldCheck className="h-8 w-8 text-primary" /> Best Practices
                </h2>
                <div className="grid gap-4">
                  {[
                    "Start small on a Demo account until you understand the engine's behavior.",
                    "Start with 0.35 as base stake with Max step of 12",
                    "Use a stable internet connection; the bot requires real-time data to execute safely.",
                    "Review your trade history after each session to refine your stake and max steps.",
                    "Never trade with funds that are essential for your daily living expenses."
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
                  <LifeBuoy className="h-8 w-8 text-primary" /> Troubleshooting
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Connection Fails</h4>
                    <p className="text-muted-foreground leading-relaxed">Verify that you are connected, if not click START to get connected</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">No Trades Executing</h4>
                    <p className="text-muted-foreground leading-relaxed">Check the Recent Trades section and see if there is no pending trades, if there is, wait for 5 minutes and if there is no change, log out and re-login</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Unexpected Stops</h4>
                    <p className="text-muted-foreground leading-relaxed">The AI Engine auto-stops if a Daily Loss Limit is hit. Check your AI dashboard statistics for hit limits.</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">UI Not Updating</h4>
                    <p className="text-muted-foreground leading-relaxed">If stats appear stuck, try refreshing the page.</p>
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
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Still have questions?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">Our community and support team are here to help you get the most out of Digit Bot Pro.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold px-10 rounded-2xl h-16 text-lg">
              <a href="https://t.me/DigitBotPro">Join Telegram Support</a>
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
