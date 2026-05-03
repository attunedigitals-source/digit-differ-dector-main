import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Save } from "lucide-react";

interface TokenSettingsProps {
  userId: string;
  onTokenSaved: (token: string) => void;
}

export function TokenSettings({ userId, onTokenSaved }: TokenSettingsProps) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);

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

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_deriv_tokens").upsert(
      { user_id: userId, deriv_api_token: token.trim() },
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
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Key className="w-4 h-4 text-primary" />
        Deriv API Token
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter your Deriv API token"
          className="bg-muted border-border font-mono text-sm"
        />
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="w-4 h-4 mr-1" />
          {hasToken ? "Update" : "Save"}
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
