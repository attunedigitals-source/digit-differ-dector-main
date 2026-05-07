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
  { id: "quick-start", title: "Quick Start" },
  { id: "register", title: "Create Account" },
  { id: "subscribe", title: "Subscribe" },
  { id: "connect-deriv", title: "Connect Deriv API" },
  { id: "setup-strategy", title: "Configure Strategy" },
  { id: "risk-controls", title: "Risk Controls" },
  { id: "start-trading", title: "Use the App" },
  { id: "best-practices", title: "Best Practices" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const highlights = [
  {
    title: "Client-side trading assistant",
    description: "Configure your Deriv digit strategy while keeping execution decisions visible in the app.",
    icon: Zap,
  },
  {
    title: "API-token workflow",
    description: "Connect with your Deriv token, select an account, and monitor connection status before trading.",
    icon: KeyRound,
  },
  {
    title: "Built-in discipline",
    description: "Use daily limits, profit targets, pauses, and manual stop controls to reduce emotional trading.",
    icon: ShieldCheck,
  },
];

const quickStartSteps = [
  "Create or sign in to your Digit Bot Pro account.",
  "Activate your subscription so the dashboard unlocks.",
  "Create a Deriv API token with the required trading permissions.",
  "Paste the token in Digit Bot Pro and confirm the connection is active.",
  "Set your market, stake, strategy rules, and risk limits before pressing Start.",
];

const setupCards = [
  {
    id: "register",
    title: "1. Create your account",
    icon: UserPlus,
    steps: [
      "Open the homepage and choose Get Started.",
      "Enter a working email address and a strong password.",
      "Confirm your email if prompted, then sign in to the dashboard.",
      "Keep your login details private and avoid shared devices for trading sessions.",
    ],
  },
  {
    id: "subscribe",
    title: "2. Subscribe for access",
    icon: CircleDollarSign,
    steps: [
      "After login, open the subscription or paywall screen.",
      "Choose the plan that matches your intended usage.",
      "Complete payment and submit proof if the app requests it.",
      "Wait for access confirmation, then refresh your dashboard if needed.",
    ],
  },
  {
    id: "connect-deriv",
    title: "3. Connect Deriv API",
    icon: KeyRound,
    steps: [
      "Sign in to Deriv and create an API token with trading permissions.",
      "Copy the token exactly and paste it into the token settings panel.",
      "Save the token and confirm the app shows a connected status.",
      "If multiple Deriv accounts appear, select the account you want the bot to use.",
    ],
  },
];

const strategyChecklist = [
  "Pick the Deriv synthetic index or digit market you want to monitor.",
  "Set a base stake that fits your bankroll instead of chasing quick recovery.",
  "Choose contract direction and digit logic according to your tested playbook.",
  "Review signal confidence, recent performance, and connection status before automation.",
];

const riskChecklist = [
  "Set a maximum daily loss before your first trade.",
  "Set a realistic profit target and stop after reaching it.",
  "Limit open trades and use pause intervals to prevent rapid overtrading.",
  "Stop immediately if results differ from the strategy you configured.",
];

const bestPractices = [
  "Start small until you understand how the app behaves on your selected market.",
  "Run one strategy at a time so performance is easy to review.",
  "Use a stable internet connection and keep the browser tab active while trading.",
  "Review trade history after each session and adjust settings only when you have evidence.",
  "Never trade funds you cannot afford to lose; digit trading is high risk and results are not guaranteed.",
];

const troubleshooting = [
  {
    issue: "Connection fails",
    fix: "Recheck the token, required permissions, internet connection, and whether the selected Deriv account is active.",
  },
  {
    issue: "No trades execute",
    fix: "Confirm the market is selected, strategy rules are complete, account balance is sufficient, and the bot is started.",
  },
  {
    issue: "Bot stops unexpectedly",
    fix: "Check whether a daily loss limit, profit target, open-trade limit, or pause rule was triggered.",
  },
  {
    issue: "Subscription still locked",
    fix: "Refresh the app after confirmation, then contact support with your account email and proof of payment if access is still pending.",
  },
];

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <header className="border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">Digit Bot <span className="text-primary">Pro</span></p>
              <p className="text-sm text-muted-foreground">Documentation & setup guide</p>
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

      <main className="container mx-auto px-6 py-10 md:py-14">
        <section id="overview" className="mb-10 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-secondary/80 via-card to-background p-8 shadow-2xl md:p-12">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" /> Complete setup walkthrough
            </div>
            <h1 className="mb-5 text-4xl font-bold tracking-tight md:text-6xl">
              Learn Digit Bot Pro from setup to safer daily operation.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Digit Bot Pro is a client-side trading assistant for Deriv digit strategies. Use this guide to create your account, connect your Deriv API token, configure a strategy, apply risk controls, and troubleshoot common issues.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border/80 bg-background/60">
                  <CardContent className="p-5">
                    <Icon className="mb-4 h-7 w-7 text-primary" />
                    <h3 className="mb-2 font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="h-fit rounded-2xl border border-border bg-card/80 p-5 shadow-xl lg:sticky lg:top-8">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <BookOpen className="h-4 w-4 text-primary" /> Guide Sections
            </h2>
            <nav className="space-y-1 text-sm">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                >
                  {section.title}
                </a>
              ))}
            </nav>

            <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" /> Risk reminder
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Trading synthetic indices and digit contracts is high risk. The bot does not guarantee profits, and you remain responsible for every trade placed from your account.
              </p>
            </div>
          </aside>

          <div className="space-y-8">
            <section id="quick-start" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="mb-3 text-2xl font-bold">Quick Start</h2>
              <p className="mb-6 text-muted-foreground">
                Follow this checklist if you want the shortest path from signup to a controlled first session.
              </p>
              <ol className="grid gap-3">
                {quickStartSteps.map((step, index) => (
                  <li key={step} className="flex gap-4 rounded-xl border border-border bg-background/60 p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{index + 1}</span>
                    <span className="pt-1 text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-6">
              {setupCards.map((card) => {
                const Icon = card.icon;
                return (
                  <section key={card.id} id={card.id} className="rounded-2xl border border-border bg-card p-6 md:p-8">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h2 className="text-2xl font-bold">{card.title}</h2>
                    </div>
                    <ul className="grid gap-3 text-muted-foreground md:grid-cols-2">
                      {card.steps.map((step) => (
                        <li key={step} className="flex gap-3 rounded-xl bg-background/50 p-4">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <section id="setup-strategy" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Settings2 className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Configure Strategy</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {strategyChecklist.map((item) => (
                  <div key={item} className="rounded-xl border border-border bg-background/50 p-4 text-muted-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section id="risk-controls" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Set Risk Controls</h2>
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-5 text-muted-foreground">
                <p className="mb-4 text-foreground">
                  Configure risk limits before starting automation. If a limit is reached, stop and review the session instead of increasing stake size.
                </p>
                <ul className="grid gap-3 md:grid-cols-2">
                  {riskChecklist.map((item) => (
                    <li key={item} className="flex gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section id="start-trading" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <PlayCircle className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">How to Use the App</h2>
              </div>
              <ol className="space-y-3 text-muted-foreground">
                <li><strong className="text-foreground">1. Verify:</strong> Confirm your Deriv token, selected account, balance, and live connection status.</li>
                <li><strong className="text-foreground">2. Review:</strong> Check market selection, stake, strategy logic, profit target, and maximum loss.</li>
                <li><strong className="text-foreground">3. Start:</strong> Turn on the auto-trader only when all settings match your plan.</li>
                <li><strong className="text-foreground">4. Monitor:</strong> Watch live signals, open trades, and performance during the session.</li>
                <li><strong className="text-foreground">5. Stop:</strong> Pause or stop the bot anytime from the control panel, especially after hitting a limit.</li>
              </ol>
            </section>

            <section id="best-practices" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="mb-5 text-2xl font-bold">Best Practices</h2>
              <div className="grid gap-3">
                {bestPractices.map((practice) => (
                  <div key={practice} className="flex gap-3 rounded-xl bg-background/50 p-4 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span>{practice}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="troubleshooting" className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LifeBuoy className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold">Troubleshooting</h2>
              </div>
              <div className="grid gap-4">
                {troubleshooting.map((item) => (
                  <div key={item.issue} className="rounded-xl border border-border bg-background/50 p-5">
                    <h3 className="mb-2 font-semibold text-foreground">{item.issue}</h3>
                    <p className="text-muted-foreground">{item.fix}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5">
                <h3 className="mb-2 font-semibold text-primary">Still need help?</h3>
                <p className="text-muted-foreground">
                  Contact support with your account email, the affected Deriv account, screenshots of the error, and the steps you already tried. Never share your password or full API token with anyone.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
