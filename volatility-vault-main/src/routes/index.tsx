import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getOAuthUrl, getActiveAccount } from "@/lib/deriv";
import { TrendingUp, ShieldCheck, Bot, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DerivPilot — Automated Over/Under Bot for Volatility Indices" },
      {
        name: "description",
        content:
          "Trade Deriv Volatility indices with an automated Over/Under digit bot. Sign in securely with Deriv OAuth — no API tokens to manage.",
      },
      { property: "og:title", content: "DerivPilot — Over/Under Bot" },
      {
        property: "og:description",
        content: "Automate Digit Over 2 / Under 7 trades with Deriv OAuth.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    if (getActiveAccount()) navigate({ to: "/dashboard" });
  }, [navigate]);

  const handleLogin = () => {
    window.location.href = getOAuthUrl();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Bot className="h-5 w-5 text-primary" />
            DerivPilot
          </div>
          <Button onClick={handleLogin} variant="default">
            Sign in with Deriv
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure OAuth 2.0 — no API
            tokens required
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight">
            Automated <span className="text-primary">Over / Under</span> bot for
            Deriv Volatility indices
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Sign in with your Deriv account, configure stake, martingale and
            risk limits, and let the bot trade Digit Over 2 / Under 7 while you
            watch live PnL.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" onClick={handleLogin}>
              Sign in with Deriv
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          <Feature
            icon={<TrendingUp className="h-5 w-5" />}
            title="Volatility indices"
            text="Trade R_10, R_25, R_50, R_75, R_100 — synthetic markets that run 24/7."
          />
          <Feature
            icon={<Zap className="h-5 w-5" />}
            title="Classic Over/Under"
            text="Digit Over 2 or Under 7 with optional martingale recovery."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Take-profit & stop-loss"
            text="Bot auto-stops when your profit target or loss limit is hit."
          />
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Trading involves risk. DerivPilot is an unofficial client for the Deriv
        API.
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
