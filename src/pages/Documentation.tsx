import { Link } from "react-router-dom";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "register", title: "1. How to Register" },
  { id: "connect-deriv", title: "2. Connect Deriv API" },
  { id: "setup-strategy", title: "3. Configure AI Engine" },
  { id: "start-trading", title: "4. Start Trading" },
  { id: "risk-controls", title: "5. Risk & Safety" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Hero Header */}
      <div className="bg-secondary/20 border-b border-border py-16 px-6 mb-12">
        <div className="container mx-auto max-w-5xl">
          <Link to="/" className="text-primary hover:underline mb-4 inline-block">← Back to Home</Link>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            Digit Bot Pro Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Master your trading automation with our comprehensive visual guide. From setup to execution, we've got you covered.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-6">
              <div className="border border-border rounded-2xl p-6 bg-secondary/10 backdrop-blur-sm">
                <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-primary rounded-full"></span>
                  Quick Navigation
                </h2>
                <ul className="space-y-3">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a 
                        href={`#${section.id}`} 
                        className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all duration-200 inline-block text-sm font-medium"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Need Help?</p>
                <p className="text-sm text-muted-foreground mb-4">Our support team is available via Telegram for any technical assistance.</p>
                <a href="https://t.me/DigitBotPro" className="text-sm font-bold text-primary hover:underline">Contact Support →</a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="space-y-24">
            {/* Overview Section */}
            <section id="overview" className="scroll-mt-10">
              <div className="prose prose-invert max-w-none">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                  <span className="bg-secondary p-2 rounded-lg text-primary">🚀</span>
                  Overview
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed bg-secondary/5 p-6 rounded-2xl border border-border">
                  Digit Bot Pro is an advanced, client-side trading assistant engineered for the Deriv ecosystem. 
                  By combining predictive intelligence with strict risk protocols, it allows you to execute 
                  disciplined digit-based strategies on synthetic indices with precision and speed.
                </p>
              </div>
            </section>

            {/* 1. How to Register */}
            <section id="register" className="scroll-mt-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-4">1. How to Register</h2>
                <p className="text-muted-foreground mb-6">Setting up your account is quick and secure. Follow these steps to get started.</p>
                <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                  <img src="/docs/doc-register.png" alt="Registration Guide" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 2. Connect Deriv API */}
            <section id="connect-deriv" className="scroll-mt-10">
              <div className="mb-8 space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-4">2. Connect Deriv API</h2>
                  <p className="text-muted-foreground mb-6">To enable trading, you need to link your Deriv account via a secure API token. First, locate the API settings in your Deriv dashboard.</p>
                  <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                    <img src="/docs/doc-deriv-nav.png" alt="Deriv Navigation Guide" className="w-full h-auto" />
                  </div>
                </div>

                <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20">
                  <h3 className="font-bold text-primary mb-2 flex items-center gap-2">
                    💡 Pro Tip: Secure Your Token
                  </h3>
                  <p className="text-sm text-muted-foreground">Always ensure your token has "Read", "Trade", and "Trading Information" permissions. Never select "Admin" or "Payments" for security reasons.</p>
                </div>

                <div>
                  <p className="text-muted-foreground mb-6">Once you've found the API page, create your token and copy it carefully.</p>
                  <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                    <img src="/docs/doc-deriv-setup.png" alt="Deriv API Token Creation" className="w-full h-auto" />
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Configure AI Engine */}
            <section id="setup-strategy" className="scroll-mt-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-4">3. Configure AI Engine</h2>
                <p className="text-muted-foreground mb-6">Define your trading parameters. Set your base stake, max steps (Martingale), and cooldown intervals to match your risk appetite.</p>
                <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                  <img src="/docs/doc-trading-setup.jpg" alt="AI Engine Configuration" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 4. Start Trading */}
            <section id="start-trading" className="scroll-mt-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-4">4. Start Trading</h2>
                <p className="text-muted-foreground mb-6">With your API token connected and strategy configured, you are ready to initiate the AI-Trading Loop.</p>
                <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                  <img src="/docs/doc-app-setup.png" alt="How to Start Trading" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* 5. Risk & Safety */}
            <section id="risk-controls" className="scroll-mt-10">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-4">5. Risk & Safety: Wind Down</h2>
                <p className="text-muted-foreground mb-6">Trading safely is our priority. Use the "Wind Down on Next Profit" feature to exit the market gracefully after a winning trade.</p>
                <div className="rounded-2xl overflow-hidden border border-border bg-secondary/5 shadow-2xl">
                  <img src="/docs/doc-wind-down.jpg" alt="Risk Management & Wind Down" className="w-full h-auto" />
                </div>
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="scroll-mt-10">
              <div className="bg-secondary/10 p-8 md:p-12 rounded-[2.5rem] border border-border">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                  <span className="bg-red-500/10 p-2 rounded-lg text-red-500">🛠️</span>
                  Troubleshooting
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Connection Fails</h4>
                    <p className="text-sm text-muted-foreground">Ensure your API token has "Read" and "Trade" permissions. Check your internet stability and verify your Deriv account status.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">No Trades Executing</h4>
                    <p className="text-sm text-muted-foreground">Verify that your Base Stake is within balance limits and that market symbols are selected in the AI engine panel.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Unexpected Stops</h4>
                    <p className="text-sm text-muted-foreground">The AI engine automatically stops if a Daily Profit Target or Max Loss limit is reached to protect your capital.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-foreground">Token Verification Error</h4>
                    <p className="text-sm text-muted-foreground">API tokens can expire or be revoked. If you encounter errors, generate a fresh token from the Deriv dashboard and update it.</p>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Documentation;

