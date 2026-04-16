import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  ExternalLink,
  User as UserIcon,
  CreditCard
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

  // 1. Fetch User Profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-user-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, performance:admin_user_performance(*)')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000 
  });

  // Auto-select first account if none selected
  useEffect(() => {
    if (profile?.performance && profile.performance.length > 0 && !selectedAccountId) {
      setSelectedAccountId(profile.performance[0].deriv_loginid);
    }
  }, [profile, selectedAccountId]);

  // 2. Fetch User Trades
  const { data: trades, isLoading: tradesLoading } = useQuery({
    queryKey: ["admin-user-trades", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
    refetchInterval: 5000 // Refresh every 5 seconds for live monitor effect
  });

  if (profileLoading || tradesLoading) {
    return (
      <AdminLayout title="User Details">
        <div className="flex items-center justify-center h-[50vh]">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  // Filter trades by selected account
  const filteredTrades = trades?.filter(t => !selectedAccountId || t.deriv_loginid === selectedAccountId);

  // Calculate Daily Stats for filtered trades
  const dailyStats = filteredTrades?.reduce((acc: any, trade) => {
    const date = new Date(trade.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = {
        date,
        totalTrades: 0,
        wins: 0,
        profit: 0,
        trades: []
      };
    }
    acc[date].totalTrades += 1;
    if (trade.result === 'won') acc[date].wins += 1;
    acc[date].profit += Number(trade.profit_loss) || 0;
    acc[date].trades.push(trade);
    return acc;
  }, {});

  const dailyArray = dailyStats ? Object.values(dailyStats).sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ) : [];

  const performance = profile?.performance?.find((p: any) => p.deriv_loginid === selectedAccountId) || profile?.performance?.[0];

  return (
    <AdminLayout title="User Performance Dashboard">
      <div className="space-y-6">
        {/* Header / Back Link */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
            <Link to="/admin/trades">
              <ArrowLeft className="w-4 h-4" /> Back to Monitor
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {profile?.performance && profile.performance.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border">
                {profile.performance.map((p: any) => (
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
            <Badge variant="outline" className={`uppercase font-bold ${
              profile?.subscription_status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/30" : "bg-muted text-muted-foreground"
            }`}>
              {profile?.subscription_status} Plan
            </Badge>
          </div>
        </div>

        {/* User Summary Card */}
        <div className="grid gap-6 md:grid-cols-4">
          <SummaryCard 
            title="User Identity" 
            value={profile?.email} 
            subtitle={profile?.created_at ? `Joined ${new Date(profile.created_at).toLocaleDateString()}` : 'Joined Date Unknown'}
            icon={<UserIcon className="w-5 h-5 text-primary" />}
          />
          <SummaryCard 
            title="Total Volume" 
            value={`${performance?.total_trades || 0}`} 
            subtitle="Trades Taken"
            icon={<Activity className="w-5 h-5 text-blue-500" />}
          />
          <SummaryCard 
            title="Net Performance" 
            value={`$${(performance?.net_profit || 0).toFixed(2)}`} 
            subtitle={`${(performance?.win_rate || 0).toFixed(1)}% Win Rate`}
            icon={(performance?.net_profit || 0) >= 0 ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
            isPositive={(performance?.net_profit || 0) >= 0}
          />
          <SummaryCard 
            title="Account Status" 
            value={profile?.role?.toUpperCase() || 'USER'} 
            subtitle={profile?.subscription_expiry ? `Expires ${new Date(profile.subscription_expiry).toLocaleDateString()}` : "Lifetime Status"}
            icon={<CreditCard className="w-5 h-5 text-purple-500" />}
          />
        </div>

        {/* Performance Breakdown */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Daily Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Daily Breakdown
              </h3>
            </div>
            <Card className="border-border bg-card/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border bg-muted/20">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-center">Trades</TableHead>
                    <TableHead className="text-xs text-center">Wins/Loss</TableHead>
                    <TableHead className="text-xs text-center">Win Rate</TableHead>
                    <TableHead className="text-xs text-right">Day's Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyArray.map((day: any) => (
                    <TableRow key={day.date} className="border-border/50 hover:bg-muted/10 transition-colors">
                      <TableCell className="text-sm font-medium">{day.date}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{day.totalTrades}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-green-500 font-bold text-xs">{day.wins}W</span>
                          <span className="text-muted-foreground text-[10px]">/</span>
                          <span className="text-destructive font-bold text-xs">{day.totalTrades - day.wins}L</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {((day.wins / day.totalTrades) * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-bold ${day.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {day.profit >= 0 ? '+' : ''}${day.profit.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Recent Trades Sidebar */}
          <div className="space-y-4">
               <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                 <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Trades</div>
                 <span className="text-[10px] opacity-70 font-mono italic">Account: {selectedAccountId}</span>
               </h3>
               <div className="space-y-3">
                {filteredTrades?.slice(0, 15).map((t) => (
                  <div key={t.id} className="p-3 rounded-lg border border-border bg-card/60 flex items-center justify-between group hover:border-primary/50 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">{getSymbolName(t.symbol)}</span>
                      <span className="text-xs font-mono">{new Date(t.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <Badge className={`text-[9px] font-bold uppercase mb-1 ${
                        t.result === 'won' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                      }`}>
                        {t.result}
                      </Badge>
                      <span className={`text-xs font-bold font-mono ${t.profit_loss >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                        {t.profit_loss >= 0 ? '+' : ''}${t.profit_loss.toFixed(2)}
                      </span>
                    </div>
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
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="flex items-center gap-2">
            <h4 className={`text-lg font-bold truncate max-w-[180px] ${isPositive !== undefined ? (isPositive ? 'text-green-500' : 'text-destructive') : ''}`}>
              {value}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="bg-background/50 p-2 rounded-lg border border-border">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function Card({ children, className }: any) {
  return <div className={`rounded-xl border shadow-sm ${className}`}>{children}</div>
}
