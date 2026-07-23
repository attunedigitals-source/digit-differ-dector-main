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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  UserMinus, 
  RefreshCcw, 
  TrendingDown, 
  AlertTriangle,
  Mail,
  MoreVertical,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  Legend
} from "recharts";

export default function ChurnAnalytics() {
  // Fetch churned users (expired > 72h)
  const { data: churnedUsers, isLoading } = useQuery({
    queryKey: ["admin-churn"],
    queryFn: async () => {
      const seventyTwoHoursAgo = new Date();
      seventyTwoHoursAgo.setHours(seventyTwoHoursAgo.getHours() - 72);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('subscription_status', 'expired')
        .lt('subscription_expiry', seventyTwoHoursAgo.toISOString())
        .order('subscription_expiry', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const StatCard = ({ title, value, icon: Icon, description, color }: any) => (
    <Card className="border-border bg-card/40">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`${color} p-3 rounded-xl`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">{title}</p>
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const CHURN_DATA = [
    { name: 'Active', value: 198, color: '#3b82f6' },
    { name: 'Churned', value: 42, color: '#ef4444' },
    { name: 'Grace Period', value: 12, color: '#f59e0b' },
  ];

  return (
    <AdminLayout title="Churn Analytics">
      <div className="space-y-8">
        {/* Retention Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard 
            title="Churn Rate" 
            value="14.2%" 
            icon={TrendingDown} 
            description="Last 30 days"
            color="bg-destructive/10 text-destructive"
          />
          <StatCard 
            title="Renewal Rate" 
            value="85.8%" 
            icon={RefreshCcw} 
            description="Automatic & Manual"
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title="Lost Users" 
            value={churnedUsers?.length || 0} 
            icon={UserMinus} 
            description="Expired > 72 hours"
            color="bg-muted text-muted-foreground"
          />
          <StatCard 
            title="Avg. Lifecycle" 
            value="4.2 Months" 
            icon={RefreshCcw} 
            description="Before churn"
            color="bg-blue-500/10 text-blue-500"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {/* Churn Chart */}
          <Card className="md:col-span-2 border-border bg-card/40">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">User Retention State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={CHURN_DATA}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {CHURN_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "8px" }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Churned Users Table */}
          <Card className="md:col-span-3 border-border bg-card/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Churned Users Ledger
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                Export CSV <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs text-center">Expiry Date</TableHead>
                  <TableHead className="text-xs text-center">Last State</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {churnedUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground text-xs italic">
                      Zero users in the 72h+ churn state. Great work!
                    </TableCell>
                  </TableRow>
                ) : churnedUsers?.map((u) => (
                  <TableRow key={u.id} className="border-border/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{u.email}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {u.id.substring(0, 8)}...</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {u.subscription_expiry ? new Date(u.subscription_expiry).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] uppercase bg-destructive/5 text-destructive border-destructive/20 font-bold">
                        Lost User
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                        <Mail className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
