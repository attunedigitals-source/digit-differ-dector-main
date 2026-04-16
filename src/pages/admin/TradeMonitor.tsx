import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Activity, 
  Search, 
  Filter, 
  TrendingUp, 
  History,
  Clock,
  ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getSymbolName } from "@/lib/deriv-symbols";

interface TradeLog {
  id: string;
  user_id: string;
  deriv_loginid: string;
  symbol: string;
  stake: number;
  barrier: number;
  result: string;
  profit_loss: number | null;
  timestamp: string;
  profiles?: { email: string };
}

export default function TradeMonitor() {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Load
    const fetchTrades = async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*, profiles(email)')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) {
        toast.error("Failed to load trade history");
      } else {
        setTrades(data as any[]);
      }
      setLoading(false);
    };

    fetchTrades();

    // 2. Real-time Subscription
    const channel = supabase
      .channel('admin-live-trades')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'trades' }, 
        (payload) => {
          // Note: In real setup, we might need a separate fetch to get the profile email 
          // or rely on a view. For this sim, we'll just prepend the new trade.
          const newTrade = payload.new as TradeLog;
          setTrades(prev => [newTrade, ...prev].slice(0, 100));
          toast.info(`New trade placed on ${getSymbolName(newTrade.symbol)}`, { duration: 2000 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTrades = trades.filter(t => 
    (t.profiles?.email || t.deriv_loginid).toLowerCase().includes(search.toLowerCase())
  );

  const winRate = trades.length > 0 
    ? (trades.filter(t => t.result === 'won').length / trades.length * 100).toFixed(1)
    : "0";

  return (
    <AdminLayout title="Trade Monitoring">
      <div className="space-y-6">
        {/* Quick Performance Indicators */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-primary/10 p-2.5 rounded-full">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Active Win Rate</p>
                <h4 className="text-xl font-bold">{winRate}%</h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-500/10 p-2.5 rounded-full">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Total Trades (Last 100)</p>
                <h4 className="text-xl font-bold">{trades.length}</h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-green-500/10 p-2.5 rounded-full">
                <Activity className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">System Status</p>
                <h4 className="text-xl font-bold text-green-500">Live Streaming</h4>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Feed Table */}
        <Card className="border-border bg-card/40">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <History className="w-4 h-4" /> Live Executions
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user or loginid..."
                className="pl-9 h-9 text-xs border-border bg-card/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-xs">User / Account</TableHead>
                <TableHead className="text-xs text-center">Symbol</TableHead>
                <TableHead className="text-xs text-center">Stake</TableHead>
                <TableHead className="text-xs text-center">Result</TableHead>
                <TableHead className="text-xs text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <Activity className="w-8 h-8 text-primary animate-pulse" />
                      <span className="text-xs text-muted-foreground">Initializing live stream...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTrades.map((t) => (
                <TableRow key={t.id} className="border-border/50 group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{t.profiles?.email || 'System User'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono">{t.deriv_loginid}</span>
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer hover:text-primary" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tight px-2">
                      {getSymbolName(t.symbol)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-bold">
                    ${t.stake.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] font-bold uppercase transition-all ${
                      t.result === 'won' ? "bg-green-500/10 text-green-500 border-green-500/30 ring-1 ring-green-500/20" :
                      t.result === 'lost' ? "bg-destructive/10 text-destructive border-destructive/30" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {t.result}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AdminLayout>
  );
}
