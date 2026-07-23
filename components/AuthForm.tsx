import { Button } from "@/components/ui/button";
import { Zap, ShieldCheck } from "lucide-react";
import { getOAuthUrl } from "@/lib/deriv-oauth";

export function AuthForm() {
  const handleLogin = async () => {
    window.location.href = await getOAuthUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <span className="text-xs md:text-sm font-semibold text-primary font-mono select-none">DIGIT DIFFERS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Automation Signal System</h1>
          <p className="text-sm md:text-base text-muted-foreground">Real-time synthetic index analysis</p>
        </div>

        <div className="space-y-6 bg-card p-8 rounded-lg border border-border shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Secure Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Sign in securely using your Deriv account. No API tokens or separate passwords required.
          </p>
          
          <Button 
            onClick={handleLogin}
            className="w-full h-12 text-lg font-semibold shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            Sign in with Deriv
          </Button>
        </div>
      </div>
    </div>
  );
}
