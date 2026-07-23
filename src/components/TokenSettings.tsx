import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Key, LogOut } from "lucide-react";
import { getOAuthUrl, getActiveAccount, clearDerivAuth } from "@/lib/deriv-oauth";
import { supabase } from "@/integrations/supabase/client";

export function TokenSettings() {
  const [connected, setConnected] = useState(false);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    const account = getActiveAccount();
    if (account) {
      setConnected(true);
      setAccountId(account.loginid);
    }
  }, []);

  const handleConnect = () => {
    window.location.href = getOAuthUrl();
  };

  const handleDisconnect = async () => {
    clearDerivAuth();
    setConnected(false);
    setAccountId("");
    await supabase.auth.signOut();
    window.location.href = "/"; // Redirect to landing page
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Key className="w-4 h-4 text-primary" />
        Deriv Connection
      </div>
      
      {connected && (
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-md border border-border flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Connected Account</span>
              <span className="font-mono text-sm">{accountId}</span>
            </div>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          </div>
          <Button onClick={handleDisconnect} variant="destructive" className="w-full h-9" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
