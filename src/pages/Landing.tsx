import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Zap, Brain, Lock, CheckCircle2, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getOAuthUrl, getActiveAccount } from "@/lib/deriv-oauth";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navigate]);

  const handleLogin = async () => {
    if (getActiveAccount()) {
      navigate("/auth");
    } else {
      window.location.href = await getOAuthUrl();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-background/80 backdrop-blur-lg border-b border-border py-4" : "bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Digit Bot <span className="text-primary">Pro</span></span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a>
            <a href="#security" className="hover:text-primary transition-colors">Security</a>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleLogin} className="hidden md:flex hover:text-primary">
              Login
            </Button>
            <Button onClick={handleLogin} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
              Get Started
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary border border-border mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New: Ensemble Trading Engine v2.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
            Master Digits with <br />
            <span className="text-primary">Predictive Intelligence</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            Digit Bot Pro is an advanced trading tool that harnesses ensemble learning and adaptive volatility analysis to deliver data-driven precision in Deriv markets.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button onClick={handleLogin} size="lg" className="h-14 px-10 text-lg font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 group">
              Launch Tool <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Link to="/documentation">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-semibold border-border hover:bg-secondary">
                View Guide
              </Button>
            </Link>
          </div>

          {/* Hero Image / Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-20" />
            <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#0a0a0a]">
              <img 
                src="/landing-hero.png" 
                alt="Digit Bot Pro Dashboard Preview" 
                className="w-full h-auto object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-60" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Precision-Engineered Features</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Everything you need from a focused trading tool for Deriv synthetic indices.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-8 bg-secondary/50 border-border hover:border-primary/50 transition-all group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Brain className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Advance AI Predictions</h3>
              <p className="text-muted-foreground leading-relaxed">
                Uses adaptive AI models to forecast higher-probability opportunities and support more confident, data-driven entries.
              </p>
            </Card>

            <Card className="p-8 bg-secondary/50 border-border hover:border-primary/50 transition-all group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Adaptive Volatility</h3>
              <p className="text-muted-foreground leading-relaxed">
                Dynamic state detection adjusts thresholds in real-time based on market volatility and momentum shifts.
              </p>
            </Card>

            <Card className="p-8 bg-secondary/50 border-border hover:border-primary/50 transition-all group">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Risk Controls</h3>
              <p className="text-muted-foreground leading-relaxed">
                Advanced risk controls with strict stop-losses, win targets, and daily capital protection rules to keep execution disciplined.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Simple 3-Step Execution</h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold">1</div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">Access & Connect</h4>
                    <p className="text-muted-foreground">Launch the tool and securely link your account via the Deriv API integration.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold">2</div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">Select & Configure</h4>
                    <p className="text-muted-foreground">Choose between Demo or Real accounts and set your AI engine parameters for trading.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold">3</div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">Smart Execution</h4>
                    <p className="text-muted-foreground">Initiate the AI trading loop and use the 'Wind Down' feature to exit safely on profit.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-2xl" />
              <div className="relative p-8 bg-card border border-border rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-bold">Live Performance</span>
                  <span className="text-primary text-sm font-medium">Auto-Syncing</span>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-primary w-5 h-5" />
                        <span className="text-sm font-medium">Trade #{2140 + i} Win</span>
                      </div>
                      <span className="text-primary font-mono">+$0.95</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-br from-secondary to-background border border-border rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex-1">
              <div className="inline-block p-3 rounded-2xl bg-primary/10 mb-6 text-primary">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Your Security, <br />Our Priority.</h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Digit Bot Pro uses the Deriv API within a privacy-first, client-side architecture. Your API credentials and trade activity stay on your device and are never stored on our servers.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5" />
                  <span>Official Deriv API Integration</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5" />
                  <span>Zero Server-Side Trade Storage</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary w-5 h-5" />
                  <span>End-to-End Encrypted Sessions</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 text-center">
              <div className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">100%</div>
              <div className="text-xl font-medium text-muted-foreground mb-8">Client-Side Execution</div>
              <Button onClick={handleLogin} size="lg" className="h-14 px-12 text-lg font-bold bg-white text-black hover:bg-white/90">
                Start free
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="text-primary w-6 h-6" />
                <span className="text-xl font-bold tracking-tight text-white">Digit Bot Pro</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Digit Bot Pro is a trading tool for Deriv synthetic indices, built to support disciplined and data-driven execution.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
              <div>
                <h4 className="font-bold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                  <li><a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a></li>
                  <li><a href="#security" className="hover:text-primary transition-colors">Security</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li><Link to="/documentation" className="hover:text-primary transition-colors">Documentation</Link></li>
                  <li><a href="#" className="hover:text-primary transition-colors">API Status</a></li>
                                    <li><a href="https://t.me/Blade234" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li><Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                                    <li><Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/50 text-center md:text-left">
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              <strong>Risk Warning:</strong> Trading synthetic indices involves significant risk of loss and is not suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite. Past performance is not indicative of future results.
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Digit Bot Pro. All rights reserved. Not affiliated with Deriv.com.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
