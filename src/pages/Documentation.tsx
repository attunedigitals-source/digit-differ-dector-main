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
  { id: "register", title: "1. Getting Started" },
  { id: "connect-deriv", title: "2. Connect Deriv API" },
  { id: "setup-strategy", title: "3. Configure AI Engine" },
  { id: "start-trading", title: "4. Use the App" },
  { id: "risk-controls", title: "5. Risk & Safety" },
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
    title: "Secure API Workflow",
    description: "Connect safely with your Deriv token. We prioritize security and only require basic trading permissions.",
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
              Digit Bot Pro is an advanced trading assistant for Deriv synthetic indices. This guide provides step-by-step visual instructions to ensure your automation is configured for maximum discipline and capital safety.
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
            
            {/* 1. How to Register */}
            <section id="register" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">1. Getting Started & Registration</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">Begin by visiting the Digit Bot Pro homepage and creating your secure account. We support both Google and email registration to keep your configuration private.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                  <img src="/docs/doc-registration-guide.png" alt="Getting Started and Registration Guide" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 2. Connect Deriv API */}
            <section id="connect-deriv" className="scroll-mt-32">
              <div className="mb-8 space-y-12">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <KeyRound className="h-6 w-6" />
                    </div>
                    <h2 className="text-3xl font-bold">2. Connect Deriv API</h2>
                  </div>
                  <p className="text-muted-foreground mb-8 text-lg">To enable trading, you need to link your Deriv account. Follow these steps to navigate to the API Token section in your Deriv Trader's Hub.</p>
                  <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                    <img src="/docs/doc-deriv-nav-guide.png" alt="Deriv Navigation Guide" className="w-full h-auto" />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-center bg-primary/5 p-8 rounded-3xl border border-primary/20">
                  <div>
                    <h3 className="font-bold text-primary text-xl mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-6 w-6" /> Secure Your Account
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Only select the necessary scopes: <strong>Read</strong>, <strong>Trade</strong>, and <strong>Trading Information</strong>. 
                      <span className="block mt-2 text-red-400 font-medium italic">Do NOT select Admin or Payments permissions.</span>
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" /> Paste token exactly as copied
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" /> Confirm "Connected" status
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-5 w-5 text-primary" /> Switch between Real/Demo easily
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground mb-8 text-lg">Once you've created your token, copy it carefully and update the settings in your Digit Bot Pro panel.</p>
                  <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                    <img src="/docs/doc-deriv-setup.png" alt="Deriv API Token Creation" className="w-full h-auto" />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Configure AI Engine */}
            <section id="setup-strategy" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Settings2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">3. Configure AI Engine</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">Set your base stake, maximum steps (Martingale), and cooldown intervals. The AI engine uses these parameters to manage your trading session automatically.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                  <img src="/docs/doc-trading-setup.jpg" alt="AI Engine Configuration" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 4. Start Trading */}
            <section id="start-trading" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PlayCircle className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold">4. Start Trading</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">With your account connected and strategy configured, you can initiate the AI-Trading Loop. Monitor performance in real-time on your dashboard.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                  <img src="/docs/doc-app-setup.png" alt="How to Start Trading" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 5. Risk & Safety */}
            <section id="risk-controls" className="scroll-mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <LockKeyhole className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-bold text-warning">5. Risk & Safety: Wind Down</h2>
                </div>
                <p className="text-muted-foreground mb-8 text-lg">Never stop abruptly. Use the <strong>Wind Down on Next Profit</strong> feature to let the bot finish its current sequence and exit the market gracefully after the next winning trade.</p>
                <div className="rounded-3xl overflow-hidden border border-border bg-secondary/5 shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                  <img src="/docs/doc-wind-down.jpg" alt="Risk Management & Wind Down" className="w-full h-auto" />
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
                    "Set a daily loss limit before you start and stick to it without exception.",
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
                    <p className="text-muted-foreground leading-relaxed">Verify your API token permissions on Deriv. Ensure you're on a stable network and that the token hasn't been revoked.</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">No Trades Executing</h4>
                    <p className="text-muted-foreground leading-relaxed">Confirm market symbols are selected in the AI panel and that your Base Stake is greater than the market minimum ($0.35).</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">Unexpected Stops</h4>
                    <p className="text-muted-foreground leading-relaxed">The AI Engine auto-stops if a Daily Loss Limit or Profit Target is hit. Check your AI dashboard statistics for hit limits.</p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground text-lg">UI Not Updating</h4>
                    <p className="text-muted-foreground leading-relaxed">If stats appear stuck, try refreshing the page. Your token and settings are saved locally and will persist.</p>
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
