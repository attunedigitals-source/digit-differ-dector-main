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

interface AccountSummary {
  user_id: string;
  deriv_loginid: string;
  total_trades: number;
  wins: number;
  net_profit: number;
  today_trades: number;
  today_profit: number;
  last_symbol: string;
  last_result: string;
  last_trade_at: string;
  win_rate: number;
  profiles?: { 
    email: string;
    subscription_status: string;
  };
}

export default function TradeMonitor() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_user_performance')
      .select('*, profiles(email, subscription_status)')
      .order('net_profit', { ascending: false });
    
    if (error) {
      console.error("Fetch accounts error:", error);
      toast.error("Failed to load account summaries");
    } else {
      setAccounts(data as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();

    // Still listen for new trades to show notifications and trigger refresh
    const channel = supabase
      .channel('admin-trade-alerts')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'trades' }, 
        (payload) => {
          toast.info(`New activity on account ${payload.new.deriv_loginid}`, { duration: 2000 });
          // Optional: Refresh the account list to update totals
          fetchAccounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredAccounts = accounts.filter(a => 
    (a.profiles?.email || a.deriv_loginid).toLowerCase().includes(search.toLowerCase())
  );

  const totalProfitToday = accounts.reduce((acc, curr) => acc + (Number(curr.today_profit) || 0), 0);
  const activeBotsToday = accounts.filter(a => (a.today_trades || 0) > 0).length;

  const averageWinRate = accounts.length > 0 
    ? (accounts.reduce((acc, curr) => acc + (Number(curr.win_rate) || 0), 0) / accounts.length).toFixed(1)
    : "0";

  // Helper for relative time
  const getRelativeTime = (timestamp: string) => {
    if (!timestamp) return "Never";
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffInSeconds < 5) return "Just now";
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AdminLayout title="Trade Monitoring">
      <div className="space-y-6">
        {/* Quick Performance Indicators */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={`border-border ${totalProfitToday >= 0 ? 'bg-green-500/5' : 'bg-destructive/5'}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`${totalProfitToday >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'} p-2.5 rounded-full`}>
                <TrendingUp className={`w-5 h-5 ${totalProfitToday >= 0 ? 'text-green-500' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Total Profit Today</p>
                <h4 className={`text-xl font-black ${totalProfitToday >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {totalProfitToday >= 0 ? '+' : ''}${totalProfitToday.toFixed(2)}
                </h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-blue-500/10 p-2.5 rounded-full">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Active Bots Today</p>
                <h4 className="text-xl font-bold">{activeBotsToday} <span className="text-xs text-muted-foreground font-normal">/ {accounts.length}</span></h4>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="bg-primary/10 p-2.5 rounded-full">
                <TrendingDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">System Win Rate</p>
                <h4 className="text-xl font-bold">{averageWinRate}%</h4>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Feed Table */}
        <Card className="border-border bg-card/40">
          <CardHeader className="flex flex-row items-center justify-between py-4 pb-1">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> Account Health Monitor
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
                  Paid Accounts ({filteredAccounts.filter(a => a.profiles?.subscription_status === 'active').length})
                </TabsTrigger>
                <TabsTrigger 
                  value="free" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 text-xs font-bold uppercase tracking-wider"
                >
                  Free Accounts ({filteredAccounts.filter(a => a.profiles?.subscription_status !== 'active').length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="paid" className="m-0">
              {renderAccountTable(filteredAccounts.filter(a => a.profiles?.subscription_status === 'active'))}
            </TabsContent>
            <TabsContent value="free" className="m-0">
              {renderAccountTable(filteredAccounts.filter(a => a.profiles?.subscription_status !== 'active'))}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  );

  function renderAccountTable(accountList: AccountSummary[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs pl-6">User / Account ID</TableHead>
            <TableHead className="text-xs text-center border-x border-border/10">Today (P/L)</TableHead>
            <TableHead className="text-xs text-center">Live Pulse</TableHead>
            <TableHead className="text-xs text-center border-x border-border/10">Trades Today</TableHead>
            <TableHead className="text-xs text-center">Lifetime Profit</TableHead>
            <TableHead className="text-xs text-right pr-6">Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-20">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="w-8 h-8 text-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">Refreshing accounts...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : accountList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs italic">
                No active accounts found in this section
              </TableCell>
            </TableRow>
          ) : accountList.map((a) => (
            <TableRow key={`${a.user_id}-${a.deriv_loginid}`} className="border-border/50 group hover:bg-muted/30 transition-colors">
              <TableCell className="pl-6 py-4">
                <div className="flex flex-col">
                  <Link 
                    to={`/admin/users/${a.user_id}`}
                    className="flex items-center gap-1.5 font-bold text-sm hover:text-primary transition-colors decoration-primary underline-offset-4 hover:underline group/email"
                  >
                    {a.profiles?.subscription_status === 'active' ? (
                      <UserCheck className="w-4 h-4 text-green-500" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                    {a.profiles?.email || 'System User'}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/email:opacity-100 transition-opacity" />
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 bg-background/50">
                      ID: {a.deriv_loginid}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className={`text-center font-mono text-sm font-black border-x border-border/5 ${(a.today_profit || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                { (a.today_profit || 0) >= 0 ? '+' : ''}${(Number(a.today_profit) || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                {a.last_symbol ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">{getSymbolName(a.last_symbol)}</span>
                    <Badge className={`text-[9px] font-bold h-4 px-1 ${
                      a.last_result === 'won' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 
                      'bg-destructive/10 text-destructive border-destructive/30'
                    }`}>
                      {a.last_result?.toUpperCase()}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">Idle</span>
                )}
              </TableCell>
              <TableCell className="text-center font-mono text-xs font-bold border-x border-border/5">
                {a.today_trades || 0}
              </TableCell>
              <TableCell className={`text-center font-mono text-xs font-bold opacity-70 ${(a.net_profit || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                ${(Number(a.net_profit) || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-right pr-6">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-medium">{getRelativeTime(a.last_trade_at)}</span>
                  <span className="text-[9px] text-muted-foreground opacity-50 font-mono">
                    {a.last_trade_at ? new Date(a.last_trade_at).toLocaleTimeString([], { hour12: false }) : '-'}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
    }
}
