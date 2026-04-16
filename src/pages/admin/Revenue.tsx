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
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Wallet,
  Calendar,
  Layers
} from "lucide-react";

export default function RevenueAnalytics() {
  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["admin-revenue-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'approved');
      
      if (error) throw error;
      return data;
    }
  });

  const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
    <Card className="border-border bg-card/40">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className={`${color} p-2 rounded-lg`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{subtext}</p>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout title="Revenue Dashboard">
      <div className="space-y-8">
        {/* Revenue Summary Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard 
            title="Lifetime Revenue" 
            value="$14,580" 
            subtext="Total processed payments"
            icon={DollarSign}
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title="Revenue This Month" 
            value="$4,250" 
            subtext="+15% from last month"
            icon={Calendar}
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title="Avg. Spend / User" 
            value="$184.20" 
            subtext="Lifetime average revenue per user"
            icon={Users}
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard 
            title="Active Subscriptions" 
            value="198" 
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
                      data={PLAN_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {PLAN_DATA.map((entry, index) => (
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
                {PLAN_DATA.map((plan, i) => (
                  <div key={plan.name} className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: COLORS[i] }} />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{plan.name}</p>
                    <p className="text-sm font-bold">${plan.revenue}</p>
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
                  <BarChart data={MONTHLY_GROWTH_DATA}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                    <XAxis dataKey="name" fontSize={11} stroke="#666" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} stroke="#666" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="target" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={24} />
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const PLAN_DATA = [
  { name: '1 Month ($45)', value: 124, revenue: 5580 },
  { name: '6 Months ($240)', value: 42, revenue: 10080 },
  { name: '12 Months ($400)', value: 15, revenue: 6000 },
];

const MONTHLY_GROWTH_DATA = [
  { name: 'Jan', revenue: 1200, target: 1000 },
  { name: 'Feb', revenue: 2100, target: 1500 },
  { name: 'Mar', revenue: 1800, target: 2000 },
  { name: 'Apr', revenue: 2800, target: 2500 },
  { name: 'May', revenue: 3400, target: 3000 },
  { name: 'Jun', revenue: 4200, target: 3500 },
];
