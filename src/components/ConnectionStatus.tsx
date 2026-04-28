import { Button } from "@/components/ui/button";
import { Power, PowerOff, Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  hasToken: boolean;
}

export function ConnectionStatus({ connected, onConnect, onDisconnect, hasToken }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${connected ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
        {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {connected ? "Connected" : "Disconnected"}
      </div>
      {connected ? (
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          <PowerOff className="w-4 h-4 mr-1" />
          Stop
        </Button>
      ) : (
        <Button size="sm" onClick={onConnect} disabled={!hasToken}>
          <Power className="w-4 h-4 mr-1" />
          Start
        </Button>
      )}
    </div>
  );
}
