import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Users, 
  CreditCard, 
  AlertCircle, 
  TrendingUp, 
  UserPlus, 
  UserMinus,
  ArrowUpRight,
  ArrowDownRight,
  Terminal
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  // Fetch high-level stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Parallel fetches for speed
      const [
        { count: totalUsers },
        { count: paidUsers },
        { count: freeUsers },
        { count: pendingPayments },
        { data: recentRevenue },
        { data: logSetting }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'free'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('amount, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(100),
        supabase.from('system_settings').select('value').eq('key', 'enable_client_logs').single()
      ]);

      return {
        totalUsers: totalUsers || 0,
        paidUsers: paidUsers || 0,
        freeUsers: freeUsers || 0,
        pendingPayments: pendingPayments || 0,
        recentRevenue: recentRevenue || [],
        enableClientLogs: logSetting?.value === true || logSetting?.value === 'true'
      };
    }
  });

  const updateLogsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'enable_client_logs', value: enabled }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Client console logs preference updated");
    },
    onError: (err: any) => {
      toast.error(`Failed to update settings: ${err.message}`);
    }
  });

  const StatCard = ({ title, value, icon: Icon, description, trend, trendValue }: any) => (
    <Card className="border-border bg-card/40 hover:bg-card/60 transition-all shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          {trend && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend === 'up' ? 'text-green-500' : 'text-destructive'}`}>
              {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trendValue}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="Overview">
      <div className="space-y-8">
        {/* Quick Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Users" 
            value={stats?.totalUsers || 0} 
            icon={Users} 
            description="Across all plan types" 
          />
          <StatCard 
            title="Paid Members" 
            value={stats?.paidUsers || 0} 
            icon={TrendingUp} 
            description="Active premium subscriptions"
            trend="up"
            trendValue="+12%"
          />
          <StatCard 
            title="Processing Payments" 
            value={stats?.pendingPayments || 0} 
            icon={CreditCard} 
            description="Waiting for admin approval" 
          />
          <StatCard 
            title="Free Accounts" 
            value={stats?.freeUsers || 0} 
            icon={AlertCircle} 
            description="Limited to demo trading" 
          />
        </div>

        {/* System Settings & Controls */}
        <Card className="border-border bg-card/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg font-semibold">Global System Controls</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
              <div className="space-y-0.5">
                <Label htmlFor="client-logs" className="text-base font-bold">Client Console Logs</Label>
                <p className="text-sm text-muted-foreground">
                  Master Switch: When disabled, all console messages are silenced for EVERYONE. When enabled, individual user preferences apply.
                </p>
              </div>
              <Switch 
                id="client-logs" 
                checked={stats?.enableClientLogs ?? false}
                onCheckedChange={(checked) => updateLogsMutation.mutate(checked)}
                disabled={updateLogsMutation.isPending}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          {/* Revenue Trends */}
          <Card className="lg:col-span-4 border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Revenue Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={REVENUE_MOCK_DATA}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }} 
                      itemStyle={{ color: "#fff", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* User Distribution */}
          <Card className="lg:col-span-3 border-border bg-card/40 text-left">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">User Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={USER_DISTRIBUTION_MOCK}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis dataKey="name" stroke="#666" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }} 
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

const REVENUE_MOCK_DATA = [
  { name: 'Jan', value: 450 },
  { name: 'Feb', value: 900 },
  { name: 'Mar', value: 1200 },
  { name: 'Apr', value: 1800 },
  { name: 'May', value: 2400 },
  { name: 'Jun', value: 2800 },
];

const USER_DISTRIBUTION_MOCK = [
  { name: 'Free', value: 342 },
  { name: 'Standard', value: 125 },
  { name: 'Premium', value: 68 },
  { name: 'VIP', value: 24 },
];
