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
  TrendingDown,
  History,
  Clock,
  ExternalLink,
  ArrowUpRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getSymbolName } from "@/lib/deriv-symbols";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { User, UserCheck } from "lucide-react";

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
  profiles?: { 
    email: string;
    subscription_status: string;
  };
  performance?: {
    total_trades: number;
    net_profit: number;
    win_rate: number;
  }[];
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
        .select('*, profiles(email, subscription_status), performance:admin_user_performance(*)')
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
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-1">
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
          
          <Tabs defaultValue="paid" className="w-full">
            <div className="px-6 border-b border-border">
              <TabsList className="bg-transparent h-10 p-0 gap-6">
                <TabsTrigger 
                  value="paid" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 text-xs font-bold uppercase tracking-wider"
                >
                  Paid Users ({filteredTrades.filter(t => t.profiles?.subscription_status === 'active').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="free" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 text-xs font-bold uppercase tracking-wider"
                >
                  Free Users ({filteredTrades.filter(t => t.profiles?.subscription_status !== 'active').length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="paid" className="m-0">
              {renderTradeTable(filteredTrades.filter(t => t.profiles?.subscription_status === 'active'))}
            </TabsContent>
            <TabsContent value="free" className="m-0">
              {renderTradeTable(filteredTrades.filter(t => t.profiles?.subscription_status !== 'active'))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  );

  function renderTradeTable(tradeList: TradeLog[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs pl-6">User / Account</TableHead>
            <TableHead className="text-xs">Lifetime Perf</TableHead>
            <TableHead className="text-xs text-center">Symbol</TableHead>
            <TableHead className="text-xs text-center">Stake</TableHead>
            <TableHead className="text-xs text-center">Result</TableHead>
            <TableHead className="text-xs text-right pr-6">Timestamp</TableHead>
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
          ) : tradeList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs italic">
                No active trades found in this section
              </TableCell>
            </TableRow>
          ) : tradeList.map((t) => (
            <TableRow key={t.id} className="border-border/50 group hover:bg-muted/30 transition-colors">
              <TableCell className="pl-6">
                <div className="flex flex-col">
                  <Link 
                    to={`/admin/users/${t.user_id}`}
                    className="flex items-center gap-1.5 font-medium text-sm hover:text-primary transition-colors decoration-primary underline-offset-4 hover:underline group"
                  >
                    {t.profiles?.subscription_status === 'active' ? (
                      <UserCheck className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {t.profiles?.email || 'System User'}
                    <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                  <div className="flex items-center gap-2 ml-5">
                    <span className="text-[10px] text-muted-foreground font-mono">{t.deriv_loginid}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-[10px]">
                    <Activity className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium whitespace-nowrap">{t.performance?.[0]?.total_trades || 0} Trd</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    { (t.performance?.[0]?.net_profit || 0) >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    )}
                    <span className={`font-bold ${(t.performance?.[0]?.net_profit || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                      ${(t.performance?.[0]?.net_profit || 0).toFixed(2)}
                    </span>
                    <span className="text-[9px] text-muted-foreground opacity-70">
                      ({(t.performance?.[0]?.win_rate || 0).toFixed(0)}%)
                    </span>
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
              <TableCell className="text-right text-xs text-muted-foreground pr-6">
                {new Date(t.timestamp).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
}
