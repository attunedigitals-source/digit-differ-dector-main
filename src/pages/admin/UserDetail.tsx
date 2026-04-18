import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar,
  Clock,
  User as UserIcon,
  CreditCard,
  AlertCircle
} from "lucide-react";
import { getSymbolName } from "@/lib/deriv-symbols";

interface Trade {
  id: string;
  symbol: string;
  stake: number;
  result: string;
  profit_loss: number;
  timestamp: string;
  deriv_loginid: string;
}

export default function UserDetail() {
  const { userId } = useParams();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Real-time synchronization: Invalidate all queries when a new trade is posted for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`admin-user-sync-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'trades',
          filter: `user_id=eq.${userId}` 
        },
        () => {
          // Invalidate performance and profit queries for instant update
          queryClient.invalidateQueries({ queryKey: ["admin-user-performance", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin-user-trades", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin-user-daily-history", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin-user-dual-pl", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // 1. Fetch User Profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // 1b. Fetch User Performance
  const { data: performanceList } = useQuery({
    queryKey: ["admin-user-performance", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_user_performance')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000 // Faster polling for P/L cards
  });

  // Auto-select first account
  useEffect(() => {
    if (performanceList && performanceList.length > 0 && !selectedAccountId) {
      setSelectedAccountId(performanceList[0].deriv_loginid);
    }
  }, [performanceList, selectedAccountId]);

  // 2. Fetch User Trades (Sidebar)
  const { data: trades } = useQuery({
    queryKey: ["admin-user-trades", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50); 
      if (error) throw error;
      return (data || []) as Trade[];
    },
    refetchInterval: 5000 // Faster trade feed
  });

  // 3. Fetch Daily Summary (WITH SMART FALLBACK)
  const { data: dailyHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["admin-user-daily-history", userId],
    queryFn: async () => {
      try {
        // [PRIMARY] Try high-speed RPC function first
        const { data, error: rpcError } = await supabase.rpc('get_admin_user_daily_summary', { 
          p_user_id: userId 
        });
        
        if (!rpcError && data && data.length > 0) return data;

        // [FALLBACK] Direct table aggregation
        const { data: rawTrades, error: tableError } = await supabase
          .from('trades')
          .select('timestamp, result, profit_loss, deriv_loginid')
          .eq('user_id', userId)
          .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('timestamp', { ascending: false })
          .limit(10000); // Increased limit for history

        if (tableError) throw tableError;
        if (!rawTrades) return [];

        const grouped = rawTrades.reduce((acc: any, t) => {
          const date = new Date(t.timestamp).toISOString().split('T')[0];
          const key = `${date}-${t.deriv_loginid}`;
          if (!acc[key]) {
            acc[key] = { trade_date: date, deriv_loginid: t.deriv_loginid, total_trades: 0, wins: 0, daily_profit: 0 };
          }
          acc[key].total_trades++;
          if (t.result === 'won') acc[key].wins++;
          acc[key].daily_profit += Number(t.profit_loss) || 0;
          return acc;
        }, {});

        return Object.values(grouped).sort((a: any, b: any) => b.trade_date.localeCompare(a.trade_date));
      } catch (err) {
        console.error("Aggregation Error:", err);
        return [];
      }
    },
    refetchInterval: 10000 // Faster daily history update
  });

  // 4. Calculate Dual-Timezone Daily P/L
  const { data: dualPL } = useQuery({
    queryKey: ["admin-user-dual-pl", userId, profile?.timezone, selectedAccountId],
    queryFn: async () => {
      // Fetch using RPCs for accuracy and speed
      const localTZ = profile?.timezone || "UTC";
      const { data: watPL, error: watError } = await supabase.rpc('get_user_account_daily_pl', {
        p_user_id: userId,
        p_account_id: selectedAccountId,
        p_timezone: "Africa/Lagos"
      });

      const { data: localPL, error: localError } = await supabase.rpc('get_user_account_daily_pl', {
        p_user_id: userId,
        p_account_id: selectedAccountId,
        p_timezone: localTZ
      });

      if (watError || localError) throw (watError || localError);

      return {
        wat: Number(watPL || 0),
        local: Number(localPL || 0)
      };
    },
    enabled: !!profile && !!selectedAccountId,
    refetchInterval: 5000 
  });

  if (profileLoading && !profile) {
    return (
      <AdminLayout title="User Details">
        <div className="flex items-center justify-center h-[50vh]">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout title="User Not Found">
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <p className="text-muted-foreground">The requested user does not exist.</p>
          <Button asChild><Link to="/admin/users">Back to Users</Link></Button>
        </div>
      </AdminLayout>
    );
  }

  const filteredDailyHistory = dailyHistory?.filter((h: any) => !selectedAccountId || h.deriv_loginid === selectedAccountId) || [];
  const filteredRecentTrades = trades?.filter(t => !selectedAccountId || t.deriv_loginid === selectedAccountId) || [];
  const performance = performanceList?.find((p: any) => p.deriv_loginid === selectedAccountId) || performanceList?.[0];

  return (
    <AdminLayout title="User Performance Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link to="/admin/users"><ArrowLeft className="w-4 h-4" /> Back to Users</Link>
          </Button>
          <div className="flex items-center gap-3">
            {performanceList && performanceList.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border">
                {performanceList.map((p: any) => (
                  <Button
                    key={p.deriv_loginid}
                    variant={selectedAccountId === p.deriv_loginid ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-[10px] font-bold uppercase py-0"
                    onClick={() => setSelectedAccountId(p.deriv_loginid)}
                  >
                    {p.deriv_loginid}
                  </Button>
                ))}
              </div>
            )}
            <Badge variant="outline" className={`uppercase font-bold ${profile?.subscription_status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-muted text-muted-foreground"}`}>
              {profile?.subscription_status || 'free'} Plan
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard title="User Identity" value={profile?.email} subtitle={`TZ: ${profile?.timezone || 'UTC'}`} icon={<UserIcon className="w-5 h-5 text-primary" />} />
          <SummaryCard title="Today (WAT)" value={`${(dualPL?.wat || 0) >= 0 ? "+" : ""}${(dualPL?.wat || 0).toFixed(2)}`} subtitle="Africa/Lagos" icon={<TrendingUp className="w-5 h-5 text-green-500" />} isPositive={(dualPL?.wat || 0) >= 0} />
          <SummaryCard title="Today (Local)" value={`${(dualPL?.local || 0) >= 0 ? "+" : ""}${(dualPL?.local || 0).toFixed(2)}`} subtitle="Client Timeframe" icon={<TrendingUp className="w-5 h-5 text-blue-500" />} isPositive={(dualPL?.local || 0) >= 0} />
          <SummaryCard title="Total Volume" value={`${performance?.total_trades || 0}`} subtitle="Trades Taken" icon={<Activity className="w-5 h-5 text-slate-500" />} />
          <SummaryCard title="Net Profit" value={`$${(Number(performance?.net_profit) || 0).toFixed(2)}`} subtitle={`${(Number(performance?.win_rate) || 0).toFixed(1)}% Win Rate`} icon={(Number(performance?.net_profit) || 0) >= 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-destructive" />} isPositive={(Number(performance?.net_profit) || 0) >= 0} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1"><Calendar className="w-4 h-4" /> Daily Breakdown</h3>
            
            <Card className="border-border bg-card/40 overflow-hidden min-h-[100px] flex flex-col">
              {historyLoading && filteredDailyHistory.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-12">
                  <Activity className="w-6 h-6 text-primary animate-pulse" />
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow className="bg-muted/20 border-border"><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs text-center">Trades</TableHead><TableHead className="text-xs text-center">Wins/Loss</TableHead><TableHead className="text-xs text-center">Win Rate</TableHead><TableHead className="text-xs text-right">Profit</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredDailyHistory.map((day: any) => (
                      <TableRow key={`${day.trade_date}-${day.deriv_loginid}`} className="border-border/50 hover:bg-muted/10 transition-colors">
                        <TableCell className="text-sm font-medium">{new Date(day.trade_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-center font-mono text-xs">{day.total_trades}</TableCell>
                        <TableCell className="text-center"><div className="flex items-center justify-center gap-1.5"><span className="text-green-500 font-bold text-xs">{day.wins}W</span><span className="text-muted-foreground text-[10px]">/</span><span className="text-destructive font-bold text-xs">{Number(day.total_trades) - Number(day.wins)}L</span></div></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[10px] font-mono">{((Number(day.wins) / Number(day.total_trades)) * 100).toFixed(1)}%</Badge></TableCell>
                        <TableCell className={`text-right font-mono text-sm font-bold ${(Number(day.daily_profit) || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>{(Number(day.daily_profit) || 0) >= 0 ? '+' : ''}{(Number(day.daily_profit) || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredDailyHistory.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-xs italic">No trade history found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between px-1"><span><Clock className="w-4 h-4 mr-2 inline" />Recent</span></h3>
            <div className="space-y-3">
              {filteredRecentTrades.map((t) => (
                <div key={t.id} className="p-3 rounded-lg border border-border bg-card/60 flex items-center justify-between group hover:border-primary/50 transition-colors">
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">{getSymbolName(t.symbol)}</span><span className="text-xs font-mono">{new Date(t.timestamp).toLocaleTimeString()}</span></div>
                  <div className="flex flex-col items-end"><Badge className={`text-[9px] font-bold uppercase mb-1 ${t.result === 'won' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'}`}>{t.result}</Badge><span className={`text-xs font-bold font-mono ${(Number(t.profit_loss) || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>{(Number(t.profit_loss) || 0) >= 0 ? '+' : ''}${(Number(t.profit_loss) || 0).toFixed(2)}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ title, value, subtitle, icon, isPositive }: any) {
  return (
    <Card className="border-border bg-card/40 p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{title}</p>
          <h4 className={`text-lg font-bold truncate ${isPositive !== undefined ? (isPositive ? 'text-green-500' : 'text-destructive') : ''}`}>{value}</h4>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="p-2 rounded-lg bg-background/50 border border-border">{icon}</div>
      </div>
    </Card>
  );
}

function Card({ children, className }: any) {
  return <div className={`rounded-xl border shadow-sm ${className}`}>{children}</div>
}
