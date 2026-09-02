import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useAutoTrader } from "@/hooks/useAutoTrader";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PerformancePanel } from "@/components/PerformancePanel";
import { LiveTicker } from "@/components/LiveTicker";
import { AccountSelector } from "@/components/AccountSelector";
import { TradingPanel } from "@/components/TradingPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Zap } from "lucide-react";
import { getActiveAccount, getAccounts, setActiveAccount, clearDerivAuth } from "@/lib/deriv-oauth";
import { TrialCountdown } from "@/components/TrialCountdown";

export default function Dashboard() {
  const { user, profile, signOut, isPaid, isAdmin, loading: authLoading, profileLoading } = useAuth();
  
  const [activeOAuthAccount, setActiveOAuthAccount] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Reactive account detection
  useEffect(() => {
    // DO NOT enforce demo fallback while auth or profile is still loading from Supabase
    if (authLoading || profileLoading) return;

    const checkAccount = () => {
      const acc = getActiveAccount();
      if (acc) {
        // Enforce demo account default and subscription check
        const hasAccessToReal = isPaid || isAdmin;
        if (!hasAccessToReal && !acc.is_virtual) {
          // Find a demo account to switch to
          const sessionAccounts = getAccounts();
          const demoAccount = sessionAccounts.find(a => a.is_virtual);
          if (demoAccount) {
            setActiveAccount(demoAccount.loginid);
            setActiveOAuthAccount(demoAccount);
            setSessionLoading(false);
            return true;
          }
        }
        setActiveOAuthAccount(acc);
        setSessionLoading(false);
        return true;
      }
      return false;
    };

    // Initial check
    if (!checkAccount()) {
      // Retry for up to 2 seconds if not found immediately (helps on slow mobile devices)
      let retries = 0;
      const interval = setInterval(() => {
        retries++;
        if (checkAccount() || retries > 10) {
          clearInterval(interval);
          setSessionLoading(false);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isPaid, isAdmin, authLoading, profileLoading]);

  const handleLogout = async () => {
    // 1. Clear Deriv specific session data
    clearDerivAuth();
    
    // 2. Clear any other related local storage items
    localStorage.removeItem('deriv.session');
    localStorage.removeItem('deriv.accounts');
    localStorage.removeItem('deriv.activeLoginid');
    localStorage.removeItem('bt_device_id'); // Optional: reset device ID on logout if needed
    
    // 3. Clear Supabase session
    await signOut();
    
    // 4. Force a hard redirect to the landing page to ensure all memory states are wiped
    window.location.href = "/";
  };
  const { 
    connected, connect, disconnect, signals, results,
    tickCounts, lastDigits, accounts, activeLoginId, switchAccount,
    wsRef, onMessageRef, getAllStates, getSymbolState,
    getConnectionHealth
  } = useDerivWebSocket({
    accountId: activeOAuthAccount?.loginid,
    userId: user?.id,
    isPaid,
    isAdmin,
    profileLoading
  });

  // Keep activeOAuthAccount in sync when activeLoginId changes via account selector
  useEffect(() => {
    if (activeLoginId) {
      const currentAcc = getActiveAccount();
      if (currentAcc && currentAcc.loginid !== activeOAuthAccount?.loginid) {
        setActiveOAuthAccount(currentAcc);
      }
    }
  }, [activeLoginId, activeOAuthAccount]);

  const activeAccount = accounts.find(a => a.loginid === activeLoginId) ?? activeOAuthAccount ?? null;

  const { 
    config, setConfig, tradeLog, setTradeLog, 
    dailyPL, sessionPL, resetSessionPL, dailyStats, resetTradeLog, sessionState, ticksToWait, handleTradeMessage, windDownMode, activateWindDown,
    volatilityTracking, clearBlacklist, connectionQuarantine
  } = useAutoTrader(wsRef, activeAccount, connected, getSymbolState, getConnectionHealth);

  // Wire auto-trader message handler
  useEffect(() => {
    onMessageRef.current = handleTradeMessage;
    return () => {
      onMessageRef.current = null;
    };
  }, [handleTradeMessage, onMessageRef]);

  // handleSettingsSaved is no longer needed with OAuth


  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Premium Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 shadow-inner">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse" />
              <span className="font-bold tracking-tighter text-base sm:text-lg text-primary whitespace-nowrap">DIGIT BOT PRO</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              Live Digits Engine
            </div>
          </div>
          
          <div className="flex-1 flex justify-center">
            {profile && <TrialCountdown profile={profile} />}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
            <ConnectionStatus
              connected={connected}
              onConnect={async () => {
                if (config.enabled) {
                  setConfig({ ...config, enabled: false });
                }
                await connect();
              }}
              onDisconnect={disconnect}
              hasToken={!!activeOAuthAccount || accounts.length > 0}
            />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Config & Control */}
          <div className="lg:col-span-4 space-y-6">
            
            {connected && accounts.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <AccountSelector
                  accounts={accounts}
                  activeLoginId={activeLoginId}
                  onSelectAccount={switchAccount}
                />
              </div>
            )}

            <TradingPanel
              config={config}
              onConfigChange={setConfig}
              sessionState={sessionState}
              ticksToWait={ticksToWait}
              tradeLog={tradeLog}
              connected={connected}
              hasToken={!!activeOAuthAccount}
              balance={activeAccount?.balance}
              sessionPL={sessionPL}
              onResetSessionPL={resetSessionPL}
              windDownMode={windDownMode}
              onActivateWindDown={activateWindDown}
              profile={profile}
              volatilityTracking={volatilityTracking}
              onClearBlacklist={clearBlacklist}
              getSymbolState={getSymbolState}
              connectionQuarantine={connectionQuarantine}
            />
          </div>

          {/* Right Column: Performance & Live Data */}
          <div className="lg:col-span-8 space-y-6">
            <PerformancePanel 
              tradeLog={tradeLog} 
              onReset={resetTradeLog} 
              activeAccount={activeAccount} 
              dailyPL={dailyPL}
              dailyStats={dailyStats}
            />

            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Market Ticker</h3>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">LIVE TICKS</Badge>
              </div>
              <LiveTicker 
                tickCounts={tickCounts} 
                lastDigits={lastDigits} 
                selectedSymbols={[]} // Ticker can show all
                avoidDigits={{}} // Not applicable in O/U
                allStates={getAllStates()}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
