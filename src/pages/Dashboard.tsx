import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDerivWebSocket } from "@/hooks/useDerivWebSocket";
import { useAutoTrader } from "@/hooks/useAutoTrader";
import { TokenSettings } from "@/components/TokenSettings";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { SignalsTable } from "@/components/SignalsTable";
import { PerformancePanel } from "@/components/PerformancePanel";
import { Filters } from "@/components/Filters";
import { LiveTicker } from "@/components/LiveTicker";
import { AccountSelector } from "@/components/AccountSelector";
import { TradingPanel } from "@/components/TradingPanel";
import { Button } from "@/components/ui/button";
import { LogOut, Zap } from "lucide-react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [apiToken, setApiToken] = useState<string>();
  const {
    connected, connect, disconnect, signals, results,
    tickCounts, lastDigits, accounts, activeLoginId, switchAccount,
    wsRef, onSignalRef, onMessageRef,
  } = useDerivWebSocket(apiToken);

  const { config, setConfig, tradeLog, setTradeLog, avoidDigits, placeTradeForSignal, handleTradeMessage } = useAutoTrader(wsRef);

  const [symbolFilter, setSymbolFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState(75);

  // Wire auto-trader callbacks
  useEffect(() => {
    onSignalRef.current = placeTradeForSignal;
    onMessageRef.current = handleTradeMessage;
    return () => {
      onSignalRef.current = null;
      onMessageRef.current = null;
    };
  }, [placeTradeForSignal, handleTradeMessage, onSignalRef, onMessageRef]);

  const handleTokenSaved = useCallback((token: string) => {
    setApiToken(token);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-mono font-semibold text-sm text-primary">DIGIT DIFFERS</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus
              connected={connected}
              onConnect={connect}
              onDisconnect={disconnect}
              hasToken={!!apiToken}
            />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Settings */}
        <TokenSettings userId={user.id} onTokenSaved={handleTokenSaved} />

        {/* Account Balances */}
        {connected && accounts.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <AccountSelector
              accounts={accounts}
              activeLoginId={activeLoginId}
              onSelectAccount={switchAccount}
            />
          </div>
        )}

        {/* Auto-Trading Panel */}
        <TradingPanel
          autoTradeEnabled={config.enabled}
          onAutoTradeToggle={(enabled) => setConfig((c) => ({ ...c, enabled }))}
          stake={config.stake}
          onStakeChange={(stake) => setConfig((c) => ({ ...c, stake }))}
          selectedSymbols={config.selectedSymbols}
          onSymbolsChange={(selectedSymbols) => setConfig((c) => ({ ...c, selectedSymbols }))}
          minConfidence={config.minConfidence}
          onMinConfidenceChange={(minConfidence) => setConfig((c) => ({ ...c, minConfidence }))}
          useRandomDigits={config.useRandomDigits}
          onRandomDigitsToggle={(useRandomDigits) => setConfig((c) => ({ ...c, useRandomDigits }))}
          tradeLog={tradeLog}
          connected={connected}
          hasToken={!!apiToken}
        />

        {/* Performance */}
        <PerformancePanel tradeLog={tradeLog} onReset={() => setTradeLog([])} activeAccount={accounts.find(a => a.loginid === activeLoginId) ?? null} />

        {/* Live Ticker */}
        <LiveTicker tickCounts={tickCounts} lastDigits={lastDigits} selectedSymbols={config.selectedSymbols} avoidDigits={avoidDigits} />

        {/* Filters */}
        <Filters
          symbolFilter={symbolFilter}
          onSymbolFilter={setSymbolFilter}
          confidenceFilter={confidenceFilter}
          onConfidenceFilter={setConfidenceFilter}
        />

        {/* Signals */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Live Signals</h2>
          <SignalsTable
            signals={signals}
            symbolFilter={symbolFilter === "all" ? "" : symbolFilter}
            confidenceFilter={confidenceFilter}
          />
        </div>
      </main>
    </div>
  );
}
