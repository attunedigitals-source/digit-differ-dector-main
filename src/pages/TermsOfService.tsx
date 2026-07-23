import { Link } from "react-router-dom";

const TermsOfService = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
        <Link to="/" className="text-primary hover:underline">← Back to Home</Link>
      </div>
      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>These Terms of Service govern your access to and use of Digit Bot Pro. By using the service, you agree to these terms.</p>
        <h2 className="text-xl font-bold text-foreground">1. Eligibility</h2>
        <p>You must be legally permitted to use automation-related software in your jurisdiction and be responsible for ensuring local compliance.</p>
        <h2 className="text-xl font-bold text-foreground">2. Nature of Service</h2>
        <p>Digit Bot Pro provides tooling and automation support; it is not investment advice, brokerage, or guaranteed profit service.</p>
        <h2 className="text-xl font-bold text-foreground">3. Account Responsibilities</h2>
        <p>You are responsible for account security and all activity conducted through your account.</p>
        <h2 className="text-xl font-bold text-foreground">4. Payments and Subscriptions</h2>
        <p>Paid access features are governed by the plan presented at purchase. Fees may be non-refundable except where required by law or explicitly stated.</p>
        <h2 className="text-xl font-bold text-foreground">5. Risk Disclosure</h2>
        <p>Automating synthetic indices carries significant financial risk. You accept full responsibility for gains, losses, and decisions made using the tool.</p>
        <h2 className="text-xl font-bold text-foreground">6. Prohibited Conduct</h2>
        <p>You may not misuse the platform, bypass access controls, reverse engineer protected areas, disrupt service operations, or violate any law while using the app.</p>
        <h2 className="text-xl font-bold text-foreground">7. Service Availability</h2>
        <p>We may modify, suspend, or discontinue features at any time, including maintenance windows, security actions, and infrastructure upgrades.</p>
        <h2 className="text-xl font-bold text-foreground">8. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, Digit Bot Pro and its operators are not liable for indirect, incidental, special, consequential, or automation-related losses.</p>
        <h2 className="text-xl font-bold text-foreground">9. Indemnification</h2>
        <p>You agree to indemnify and hold harmless the service and its operators against claims arising from misuse, violations of these terms, or unlawful conduct.</p>
        <h2 className="text-xl font-bold text-foreground">10. Termination</h2>
        <p>We may suspend or terminate access for violations, suspected abuse, legal requests, or security concerns.</p>
        <h2 className="text-xl font-bold text-foreground">11. Governing Terms Updates</h2>
        <p>These terms may be updated periodically. Continued use after changes means you accept the revised version.</p>
      </div>
    </div>
  </div>
);

export default TermsOfService;
