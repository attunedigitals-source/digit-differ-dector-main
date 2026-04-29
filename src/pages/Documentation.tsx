import { Link } from "react-router-dom";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "register", title: "How to Register" },
  { id: "subscribe", title: "How to Subscribe" },
  { id: "connect-deriv", title: "Connect Deriv API" },
  { id: "setup-strategy", title: "Configure Strategy" },
  { id: "risk-controls", title: "Set Risk Controls" },
  { id: "start-trading", title: "How to Use the App" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

const Documentation = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-bold">Digit Bot Pro Documentation</h1>
          <Link to="/" className="text-primary hover:underline">← Back to Home</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          <aside className="md:sticky md:top-8 h-fit border border-border rounded-xl p-5 bg-secondary/30">
            <h2 className="font-bold mb-4">Guide Sections</h2>
            <ul className="space-y-2 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <main className="space-y-10">
            <section id="overview">
              <h2 className="text-2xl font-bold mb-3">Overview</h2>
              <p className="text-muted-foreground leading-relaxed">
                Digit Bot Pro is a client-side trading assistant designed to help users execute disciplined digit-based strategies on Deriv synthetic indices. This guide walks you from account setup to day-to-day operation.
              </p>
            </section>

            <section id="register">
              <h2 className="text-2xl font-bold mb-3">How to Register</h2>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Open the app homepage and click <strong>Get Started</strong>.</li>
                <li>Enter your email address and create a strong password.</li>
                <li>Confirm your password and submit the signup form.</li>
                <li>Check your inbox for confirmation instructions, then sign in.</li>
              </ol>
            </section>

            <section id="subscribe">
              <h2 className="text-2xl font-bold mb-3">How to Subscribe</h2>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>After logging in, open the subscription/paywall screen.</li>
                <li>Choose the preferred access plan.</li>
                <li>Complete payment and submit proof where requested.</li>
                <li>Wait for access confirmation, then refresh your dashboard.</li>
              </ol>
            </section>

            <section id="connect-deriv">
              <h2 className="text-2xl font-bold mb-3">Connect Deriv API</h2>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Sign in to your Deriv account and create an API token with trading permissions.</li>
                <li>Copy the token and paste it in the app's token settings panel.</li>
                <li>Save and verify connection status turns connected.</li>
                <li>Select the target Deriv account if multiple accounts are available.</li>
              </ol>
            </section>

            <section id="setup-strategy">
              <h2 className="text-2xl font-bold mb-3">Configure Strategy</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Choose market symbols you want the engine to analyze.</li>
                <li>Set base stake and optional progression behavior.</li>
                <li>Choose direction/contract logic based on your playbook.</li>
                <li>Review confidence signals before turning automation on.</li>
              </ul>
            </section>

            <section id="risk-controls">
              <h2 className="text-2xl font-bold mb-3">Set Risk Controls</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Set maximum daily loss and profit target.</li>
                <li>Set maximum open trades and pause intervals.</li>
                <li>Enable stop conditions to prevent overtrading.</li>
                <li>Never risk funds you cannot afford to lose.</li>
              </ul>
            </section>

            <section id="start-trading">
              <h2 className="text-2xl font-bold mb-3">How to Use the App</h2>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Connect your API token and select your account.</li>
                <li>Confirm strategy and risk settings.</li>
                <li>Start the auto-trader and monitor live signals and performance.</li>
                <li>Pause or stop the bot any time from the control panel.</li>
                <li>Review logs/history and adjust configuration as needed.</li>
              </ol>
            </section>

            <section id="troubleshooting">
              <h2 className="text-2xl font-bold mb-3">Troubleshooting</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li><strong>Connection fails:</strong> Recheck token permissions and internet stability.</li>
                <li><strong>No trades executing:</strong> Verify strategy parameters and market selection.</li>
                <li><strong>Unexpected stops:</strong> Check if a risk control limit was hit.</li>
                <li><strong>Still stuck:</strong> Use the Contact link to reach support via Telegram.</li>
              </ul>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
