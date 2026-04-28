import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Zap } from "lucide-react";
import { startDerivOAuth } from "@/lib/deriv-oauth";


interface TokenSettingsProps {
  userId: string;
  onTokenSaved: (token: string) => void;
}

export function TokenSettings({ userId, onTokenSaved }: TokenSettingsProps) {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    supabase
      .from("user_deriv_tokens")
      .select("deriv_api_token")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHasToken(true);
          onTokenSaved(data.deriv_api_token);
        }
      });
  }, [userId, onTokenSaved]);

  const handleDerivLogin = async () => {
    try {
      await startDerivOAuth();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to start Deriv OAuth.");
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Key className="w-4 h-4 text-primary" />
          Deriv Account
        </div>
        {hasToken && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-500 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Connected
          </div>
        )}
      </div>

      <Button
        onClick={handleDerivLogin}
        variant={hasToken ? "outline" : "default"}
        className="w-full gap-2 h-11 font-bold shadow-lg shadow-primary/10"
      >
        <Zap className="w-4 h-4" />
        {hasToken ? "Reconnect Deriv Account" : "Connect Deriv Account"}
      </Button>

      <div className="pt-2 border-t border-border/50">
        <p className="text-[11px] text-muted-foreground leading-tight">
          OAuth 2.0 is now used for account authorization. No manual API token entry is required.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground leading-tight">
        Clicking connect will securely redirect you to Deriv to grant account management and trade access.
      </p>
    </div>
  );
}
