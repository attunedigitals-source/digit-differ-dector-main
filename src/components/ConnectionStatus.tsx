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
    <div className="flex items-center gap-2 sm:gap-3 relative z-[60]">
      <div className={`hidden xs:flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${connected ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
        {connected ? <Wifi className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <WifiOff className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
        {connected ? "Connected" : "Disconnected"}
      </div>
      
      {connected ? (
        <Button variant="destructive" size="sm" onClick={onDisconnect} className="h-9 sm:h-10 px-4 sm:px-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg shadow-destructive/20 active:scale-95 transition-transform">
          <PowerOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Stop
        </Button>
      ) : hasToken ? (
        <Button size="sm" onClick={onConnect} className="h-9 sm:h-10 px-4 sm:px-6 text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-95 transition-transform cursor-pointer bg-green-500 hover:bg-green-600 text-white border-none">
          <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Start
        </Button>
      ) : (
        <Button 
          size="sm" 
          variant="outline"
          onClick={async () => {
            const { getOAuthUrl } = await import("@/lib/deriv-oauth");
            window.location.href = await getOAuthUrl();
          }}
          className="h-9 sm:h-10 px-3 sm:px-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-primary/50 text-primary hover:bg-primary/10 active:scale-95 transition-transform"
        >
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Connect Account
        </Button>
      )}
    </div>
  );
}
