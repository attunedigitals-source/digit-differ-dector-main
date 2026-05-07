import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Save } from "lucide-react";

interface TokenSettingsProps {
  userId: string;
  onTokenSaved: (token: string, appId?: string, accountId?: string) => void;
}

export function TokenSettings({ userId, onTokenSaved }: TokenSettingsProps) {
  const [token, setToken] = useState("");
  const [appId, setAppId] = useState("1089");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    supabase
      .from("user_deriv_tokens")
      .select("deriv_api_token, deriv_app_id, deriv_account_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setToken(data.deriv_api_token || "");
          setAppId(data.deriv_app_id || "1089");
          setAccountId(data.deriv_account_id || "");
          setHasToken(!!data.deriv_api_token);
          onTokenSaved(data.deriv_api_token || "", data.deriv_app_id || "1089", data.deriv_account_id || "");
        }
      });
  }, [userId, onTokenSaved]);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("API token is required");
      return;
    }
    if (!appId.trim()) {
      toast.error("App ID is required");
      return;
    }
    
    setSaving(true);
    const { error } = await supabase.from("user_deriv_tokens").upsert(
      { 
        user_id: userId, 
        deriv_api_token: token.trim(),
        deriv_app_id: appId.trim(),
        deriv_account_id: accountId.trim()
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    
    if (error) {
      console.error("Token save error:", error);
      toast.error(`Failed to save settings: ${error.message}`);
    } else {
      toast.success("Settings saved");
      setHasToken(true);
      onTokenSaved(token.trim(), appId.trim(), accountId.trim());
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Key className="w-4 h-4 text-primary" />
        Deriv API Settings
      </div>
      
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">API Token</label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Deriv API token"
            className="bg-muted border-border font-mono text-sm h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">App ID</label>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. 1089"
              className="bg-muted border-border font-mono text-sm h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Account ID</label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="CR12345 or VRTC12345"
              className="bg-muted border-border font-mono text-sm h-9"
            />
            <p className="text-[9px] text-muted-foreground leading-tight">Required for PAT tokens (pat_...)</p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-9" size="sm">
          <Save className="w-4 h-4 mr-2" />
          {hasToken ? "Update Settings" : "Save Settings"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Get your token from{" "}
        <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          Deriv API Settings
        </a>
      </p>
    </div>
  );
}
