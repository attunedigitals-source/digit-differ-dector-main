import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { 
  Search, 
  UserCheck, 
  UserX, 
  CreditCard, 
  MoreVertical,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Fetch Users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch Pending Payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, profiles(email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Mutation to Approve Payment
  const approvePayment = useMutation({
    mutationFn: async ({ paymentId, userId, planType }: any) => {
      // 1. Approve payment
      await supabase.from('payments').update({ status: 'approved' }).eq('id', paymentId);
      
      // 2. Map plan to duration
      const months = planType === '1_month' ? 1 : planType === '6_months' ? 6 : 12;
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + months);

      // 3. Update profile
      await supabase.from('profiles').update({
        subscription_status: 'active',
        subscription_expiry: expiry.toISOString()
      }).eq('id', userId);

      // 4. Create subscription record
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_type: planType,
        amount: planType === '1_month' ? 45 : planType === '6_months' ? 240 : 400,
        expiry_date: expiry.toISOString(),
        status: 'active'
      });

      // 5. Trigger Email Notification (Non-blocking)
      try {
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
        if (profile) {
          await supabase.functions.invoke('send-lifecycle-email', {
            body: { 
              email: profile.email, 
              type: 'activated', 
              data: { plan: planType.replace('_', ' ') } 
            }
          });
        }
      } catch (err) {
        console.warn("Failed to send activation email:", err);
      }
    },
    onSuccess: () => {
      toast.success("Payment approved and subscription activated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    }
  });

  const filteredUsers = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <Tabs defaultValue="all-users" className="w-full">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-card/50">
              <TabsTrigger value="all-users" className="text-xs">All Users ({users?.length || 0})</TabsTrigger>
              <TabsTrigger value="pending-payments" className="text-xs">
                Pending Payments 
                {payments && payments.length > 0 && (
                  <Badge variant="destructive" className="ml-2 scale-75 h-4 w-4 p-0 flex items-center justify-center">
                    {payments.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                className="pl-9 h-9 text-xs border-border bg-card/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="all-users">
            <Card className="border-border bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Plan Expiry</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="border-border/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{u.email}</span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">{u.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase transition-colors ${
                          u.subscription_status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/30" :
                          u.subscription_status === 'pending' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {u.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {u.subscription_expiry ? new Date(u.subscription_expiry).toLocaleDateString() : 'Lifetime Free'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">{u.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                            <DropdownMenuLabel>User Controls</DropdownMenuLabel>
                            <DropdownMenuItem className="text-xs gap-2">
                              <CreditCard className="w-3.5 h-3.5" /> Extend Subscription
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs gap-2 text-destructive">
                              <ShieldAlert className="w-3.5 h-3.5" /> {u.is_suspended ? 'Reactivate' : 'Suspend Account'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pending-payments">
            <Card className="border-border bg-card/40 p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Plan Requested</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Verification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs italic">
                        No pending payment requests found
                      </TableCell>
                    </TableRow>
                  )}
                  {payments?.map((p) => (
                    <TableRow key={p.id} className="border-border/50">
                      <TableCell className="text-sm font-medium">{(p as any).profiles?.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">{p.plan_type.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">${p.amount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/30"
                          onClick={() => approvePayment.mutate({ paymentId: p.id, userId: p.user_id, planType: p.plan_type })}
                          disabled={approvePayment.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function Card({ children, className, ...props }: any) {
  return <div className={`rounded-xl border shadow-sm ${className}`} {...props}>{children}</div>
}
