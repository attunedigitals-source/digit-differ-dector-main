import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useAutoTrader } from "@/hooks/useAutoTrader";
import { TokenSettings } from "@/components/TokenSettings";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { PerformancePanel } from "@/components/PerformancePanel";
import { LiveTicker } from "@/components/LiveTicker";
import { AccountSelector } from "@/components/AccountSelector";
import { TradingPanel } from "@/components/TradingPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Zap } from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [apiToken, setApiToken] = useState<string>();
  const {
    connected, connect, disconnect, signals, results,
    tickCounts, lastDigits, accounts, activeLoginId, switchAccount,
    wsRef, onMessageRef, getAllStates
  } = useDerivWebSocket(apiToken);

  const activeAccount = accounts.find(a => a.loginid === activeLoginId) ?? null;

  const { 
    config, setConfig, tradeLog, setTradeLog, 
    dailyPL, resetTradeLog, sessionState, ticksToWait, handleTradeMessage, windDownMode, activateWindDown
  } = useAutoTrader(wsRef, activeAccount, connected);

  // Wire auto-trader message handler
  useEffect(() => {
    onMessageRef.current = handleTradeMessage;
    return () => {
      onMessageRef.current = null;
    };
  }, [handleTradeMessage, onMessageRef]);

  const handleTokenSaved = useCallback((token: string) => {
    setApiToken(token);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Premium Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 shadow-inner">
              <Zap className="w-5 h-5 text-primary animate-pulse" />
              <span className="font-bold tracking-tighter text-lg text-primary">DIGIT BOT PRO</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              Live Over/Under Engine
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ConnectionStatus
              connected={connected}
              onConnect={connect}
              onDisconnect={disconnect}
              hasToken={!!apiToken}
            />
            <Button variant="ghost" size="icon" onClick={signOut} className="hover:bg-destructive/10 hover:text-destructive transition-colors">
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
            <TokenSettings userId={user.id} onTokenSaved={handleTokenSaved} />
            
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
              hasToken={!!apiToken}
              dailyPL={dailyPL}
              windDownMode={windDownMode}
              onActivateWindDown={activateWindDown}
            />
          </div>

          {/* Right Column: Performance & Live Data */}
          <div className="lg:col-span-8 space-y-6">
            <PerformancePanel 
              tradeLog={tradeLog} 
              onReset={resetTradeLog} 
              activeAccount={activeAccount} 
              dailyPL={dailyPL}
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
