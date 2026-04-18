import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  Layers,
  Loader2
} from "lucide-react";
import { useMemo } from "react";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

export default function RevenueAnalytics() {
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["admin-revenue-full"],
    queryFn: async () => {
      // 1. Fetch all approved payments
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: true });
      
      if (payError) throw payError;

      // 2. Fetch active subscriber count from profiles
      const { count: activeSubsCount, error: profileError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active');

      if (profileError) throw profileError;

      // 3. Fetch total profiles for average spend calculation
      const { count: totalUsersCount, error: totalError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      return {
        payments: payments || [],
        activeSubsCount: activeSubsCount || 0,
        totalUsersCount: totalUsersCount || 0
      };
    }
  });

  // Calculate statistics and chart data
  const stats = useMemo(() => {
    if (!rawData) return null;

    const payments = rawData.payments;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // 1. Lifetime Revenue
    const lifetimeRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // 2. Revenue This Month
    const thisMonthRevenue = payments
      .filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // 3. Average Spend / User
    const avgSpend = rawData.totalUsersCount > 0 
      ? lifetimeRevenue / rawData.totalUsersCount 
      : 0;

    // 4. Plan Distribution (Pie Chart)
    const planCounts: Record<string, { count: number, revenue: number }> = {
      '1_month': { count: 0, revenue: 0 },
      '6_months': { count: 0, revenue: 0 },
      '12_months': { count: 0, revenue: 0 }
    };

    payments.forEach(p => {
      if (planCounts[p.plan_type]) {
        planCounts[p.plan_type].count++;
        planCounts[p.plan_type].revenue += Number(p.amount);
      }
    });

    const planData = [
      { name: 'Monthly', value: planCounts['1_month'].count, revenue: planCounts['1_month'].revenue },
      { name: '6 Months', value: planCounts['6_months'].count, revenue: planCounts['6_months'].revenue },
      { name: 'Annual', value: planCounts['12_months'].count, revenue: planCounts['12_months'].revenue },
    ].filter(p => p.revenue > 0);

    // 5. Monthly Growth (Bar Chart) - Last 6 months
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(now.getMonth() - (5 - i));
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        month: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0
      };
    });

    payments.forEach(p => {
      const d = new Date(p.created_at);
      const mIdx = last6Months.findIndex(m => m.month === d.getMonth() && m.year === d.getFullYear());
      if (mIdx !== -1) {
        last6Months[mIdx].revenue += Number(p.amount);
      }
    });

    return {
      lifetimeRevenue,
      thisMonthRevenue,
      avgSpend,
      activeSubs: rawData.activeSubsCount,
      planData: planData.length > 0 ? planData : [{ name: 'No Data', value: 1, revenue: 0 }],
      monthlyGrowth: last6Months
    };
  }, [rawData]);

  const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <Card className="border-border bg-card/40">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={`${color} p-2 rounded-lg`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-2xl font-bold tracking-tight">{isLoading ? "---" : value}</h3>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{subtext}</p>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="Revenue Dashboard">
      <div className="space-y-8">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && stats && (
          <>
            {/* Revenue Summary Grid */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard 
                title="Lifetime Revenue" 
                value={`$${stats.lifetimeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtext="Total processed payments"
                icon={DollarSign}
                color="bg-primary/10 text-primary"
              />
              <StatCard 
                title="Revenue This Month" 
                value={`$${stats.thisMonthRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtext="Performance for current period"
                icon={Calendar}
                color="bg-green-500/10 text-green-500"
              />
              <StatCard 
                title="Avg. Spend / User" 
                value={`$${stats.avgSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subtext="Lifetime average per user"
                icon={Users}
                color="bg-blue-500/10 text-blue-500"
              />
              <StatCard 
                title="Active Subscriptions" 
                value={stats.activeSubs.toString()}
                subtext="Current paying members"
                icon={TrendingUp}
                color="bg-purple-500/10 text-purple-500"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Plan Breakdown */}
              <Card className="border-border bg-card/40">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Plan Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.planData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.planData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    {stats.planData.map((plan, i) => (
                      <div key={plan.name} className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: COLORS[i] }} />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{plan.name}</p>
                        <p className="text-sm font-bold">${plan.revenue.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Performance */}
              <Card className="border-border bg-card/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Monthly Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthlyGrowth}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                        <XAxis dataKey="name" fontSize={11} stroke="#666" axisLine={false} tickLine={false} />
                        <YAxis fontSize={11} stroke="#666" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          cursor={{fill: 'rgba(255,255,255,0.05)'}}
                          contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
