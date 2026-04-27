import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Save, Zap } from "lucide-react";

interface TokenSettingsProps {
  userId: string;
  onTokenSaved: (token: string) => void;
}

export function TokenSettings({ userId, onTokenSaved }: TokenSettingsProps) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const derivAppId = import.meta.env.VITE_DERIV_APP_ID;
  const redirectUrl = import.meta.env.VITE_DERIV_REDIRECT_URL;

  useEffect(() => {
    supabase
      .from("user_deriv_tokens")
      .select("deriv_api_token")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setToken(data.deriv_api_token);
          setHasToken(true);
          onTokenSaved(data.deriv_api_token);
        }
      });
  }, [userId, onTokenSaved]);

  const handleDerivLogin = () => {
    if (!derivAppId) {
      toast.error("Deriv App ID not configured.");
      return;
    }
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${derivAppId}&l=EN`;
    window.location.href = oauthUrl;
  };

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_deriv_tokens").upsert(
      { user_id: userId, deriv_api_token: token.trim(), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) {
      console.error("Token save error:", error);
      toast.error(`Failed to save token: ${error.message}`);
    } else {
      toast.success("API token saved");
      setHasToken(true);
      onTokenSaved(token.trim());
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
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest font-bold"
        >
          {showAdvanced ? "Hide Advanced Settings" : "Advanced: Manual Token"}
        </button>
        
        {showAdvanced && (
          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter manual API token"
                className="bg-muted border-border font-mono text-xs h-9"
              />
              <Button onClick={handleSave} disabled={saving} size="sm" className="h-9">
                <Save className="w-3.5 h-3.5 mr-1" />
                {hasToken ? "Update" : "Save"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Manual tokens are useful for specific API restrictions or testing.
            </p>
          </div>
        )}
      </div>
      
      {!showAdvanced && (
        <p className="text-[11px] text-muted-foreground leading-tight">
          Clicking connect will securely redirect you to Deriv.com to authorize this tool.
        </p>
      )}
    </div>
  );
}
