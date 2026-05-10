import { Link } from "react-router-dom";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
        <Link to="/" className="text-primary hover:underline">← Back to Home</Link>
      </div>
      <div className="space-y-6 text-muted-foreground leading-relaxed">
        <p>This Privacy Policy explains how Digit Bot Pro collects, uses, stores, and protects your information when you use our website and services.</p>
        <h2 className="text-xl font-bold text-foreground">1. Information We Collect</h2>
        <p>We may collect account details (such as email), subscription/payment metadata, device/browser data, and operational logs required to maintain service quality and security.</p>
        <h2 className="text-xl font-bold text-foreground">2. Account Access and Trading Data</h2>
        <p>Digit Bot Pro is designed with a client-side architecture. Account access and active trade execution data are intended to remain on your device during normal use. We do not intentionally store your private trading credentials in plain form on our servers.</p>
        <h2 className="text-xl font-bold text-foreground">3. How We Use Information</h2>
        <p>We use information to authenticate users, provide subscriptions, support customers, improve reliability, detect abuse/fraud, and comply with legal obligations.</p>
        <h2 className="text-xl font-bold text-foreground">4. Legal Bases and Consent</h2>
        <p>By using the service, you consent to processing necessary for account administration, service delivery, and legitimate operational interests.</p>
        <h2 className="text-xl font-bold text-foreground">5. Data Retention</h2>
        <p>We retain information only as long as needed for operational, legal, accounting, and security purposes. Data no longer required is deleted or anonymized when reasonably possible.</p>
        <h2 className="text-xl font-bold text-foreground">6. Sharing and Disclosure</h2>
        <p>We do not sell personal data. We may share data with trusted service providers strictly for hosting, analytics, support, and payment operations, or where required by law.</p>
        <h2 className="text-xl font-bold text-foreground">7. Security Measures</h2>
        <p>We apply reasonable technical and organizational safeguards; however, no online service is entirely risk-free. Users are responsible for protecting their own devices, passwords, and access credentials.</p>
        <h2 className="text-xl font-bold text-foreground">8. Your Rights</h2>
        <p>Depending on your jurisdiction, you may request access, correction, deletion, restriction, or portability of your personal data. Contact support for such requests.</p>
        <h2 className="text-xl font-bold text-foreground">9. International Use</h2>
        <p>Data may be processed in different countries where infrastructure or service providers operate, subject to appropriate safeguards.</p>
        <h2 className="text-xl font-bold text-foreground">10. Policy Updates</h2>
        <p>We may update this policy from time to time. Continued use after updates indicates acceptance of the revised policy.</p>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
