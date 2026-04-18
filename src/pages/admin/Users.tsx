import { useState, useEffect } from "react";
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
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type PlanType = "1_month" | "6_months" | "12_months";

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isDowngradeOpen, setIsDowngradeOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("1_month");
  const [sendEmail, setSendEmail] = useState(true);
  
  const queryClient = useQueryClient();

  // Real-time Subscriptions for Admin Sync (with enhanced debugging)
  useEffect(() => {
    console.log("[Realtime] Initializing admin dashboard sync...");
    
    // Listen for ALL changes (INSERT, UPDATE, DELETE) on profiles and payments
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          console.log("[Realtime] Profile change detected:", payload.eventType, payload.new);
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          console.log("[Realtime] Payment change detected:", payload.eventType, payload.new);
          queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
        }
      )
      .subscribe((status, err) => {
        console.log(`[Realtime] Subscription status: ${status}`);
        if (err) console.error("[Realtime] Subscription error:", err);
        
        if (status === 'CHANNEL_ERROR') {
          console.error("[Realtime] Channel error occurred. Check RLS policies or replication settings.");
        }
      });

    return () => {
      console.log("[Realtime] Unsubscribing from admin dashboard sync...");
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch Users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error: perfError } = await supabase
        .from('profiles')
        .select('*, performance:admin_user_performance(*)')
        .order('created_at', { ascending: false });
      
      if (perfError) throw perfError;
      return profiles;
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

  // Manual Subscription Mutation
  const manualUpdate = useMutation({
    mutationFn: async ({ userId, type, planType, sendMail }: any) => {
      const email = selectedUser?.email;
      
      if (type === 'upgrade') {
        const months = planType === '1_month' ? 1 : planType === '6_months' ? 6 : 12;
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + months);

        const { error: profileError } = await supabase.from('profiles').update({
          subscription_status: 'active',
          subscription_expiry: expiry.toISOString()
        }).eq('id', userId);
        
        if (profileError) throw profileError;

        const { error: subError } = await supabase.from('subscriptions').insert({
          user_id: userId,
          plan_type: planType,
          amount: planType === '1_month' ? 45 : planType === '6_months' ? 240 : 400,
          expiry_date: expiry.toISOString(),
          status: 'active'
        });

        if (subError) throw subError;

        if (sendMail && email) {
          await supabase.functions.invoke('send-lifecycle-email', {
            body: { email, type: 'activated', data: { plan: planType.replace('_', ' ') } }
          });
        }
      } else {
        // Downgrade
        const { error: profileError } = await supabase.from('profiles').update({
          subscription_status: 'free',
          subscription_expiry: null
        }).eq('id', userId);

        if (profileError) throw profileError;

        // Update active subscriptions to expired
        const { error: subError } = await supabase.from('subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', userId)
          .eq('status', 'active');
        
        if (subError) throw subError;

        if (sendMail && email) {
          await supabase.functions.invoke('send-lifecycle-email', {
            body: { email, type: 'deactivated' }
          });
        }
      }
    },
    onSuccess: (_, variables) => {
      toast.success(`User successfully ${variables.type === 'upgrade' ? 'upgraded' : 'downgraded'}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setIsUpgradeOpen(false);
      setIsDowngradeOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Action failed");
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
                    <TableHead className="text-xs">Lifetime Perf</TableHead>
                    <TableHead className="text-xs">Plan Expiry</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id} className="border-border/50 group hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <Link 
                            to={`/admin/users/${u.id}`}
                            className="font-medium text-sm flex items-center gap-1.5 hover:text-primary transition-colors decoration-primary underline-offset-4 hover:underline"
                          >
                             {u.email}
                             <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[10px]">
                            <Activity className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">{u.performance?.[0]?.total_trades || 0} Trades</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            { (u.performance?.[0]?.net_profit || 0) >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-destructive" />
                            )}
                            <span className={`font-bold ${(u.performance?.[0]?.net_profit || 0) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                              ${(u.performance?.[0]?.net_profit || 0).toFixed(2)}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              ({(u.performance?.[0]?.win_rate || 0).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
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
                          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                            <DropdownMenuLabel>User Controls</DropdownMenuLabel>
                            {u.subscription_status !== 'active' ? (
                              <DropdownMenuItem 
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setIsUpgradeOpen(true);
                                }}
                              >
                                <UserCheck className="w-3.5 h-3.5 text-green-500" /> Upgrade to Paid
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setIsDowngradeOpen(true);
                                }}
                              >
                                <UserX className="w-3.5 h-3.5 text-destructive" /> Downgrade to Free
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-xs gap-2 cursor-not-allowed opacity-50">
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

      {/* Manual Upgrade Dialog */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Manual Upgrade</DialogTitle>
            <DialogDescription>
              Granting paid access to <span className="text-primary font-semibold">{selectedUser?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Subscription Plan</Label>
              <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="1_month">1 Month - $45</SelectItem>
                  <SelectItem value="6_months">6 Months - $240</SelectItem>
                  <SelectItem value="12_months">12 Months (1 Year) - $400</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send-upgrade-mail" 
                checked={sendEmail} 
                onCheckedChange={(v: any) => setSendEmail(v)}
                className="border-border data-[state=checked]:bg-primary shadow-lg"
              />
              <Label htmlFor="send-upgrade-mail" className="text-xs cursor-pointer">
                Send activation email notification to user
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpgradeOpen(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => manualUpdate.mutate({ userId: selectedUser.id, type: 'upgrade', planType: selectedPlan, sendMail: sendEmail })}
              disabled={manualUpdate.isPending}
            >
              {manualUpdate.isPending ? "Upgrading..." : "Confirm Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Downgrade Dialog */}
      <Dialog open={isDowngradeOpen} onOpenChange={setIsDowngradeOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm Downgrade</DialogTitle>
            <DialogDescription>
              This will immediately revoke paid access for <span className="font-semibold text-foreground">{selectedUser?.email}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="send-downgrade-mail" 
                checked={sendEmail} 
                onCheckedChange={(v: any) => setSendEmail(v)}
                className="border-border data-[state=checked]:bg-destructive"
              />
              <Label htmlFor="send-downgrade-mail" className="text-xs cursor-pointer">
                Send deactivation email notification to user
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDowngradeOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={() => manualUpdate.mutate({ userId: selectedUser.id, type: 'downgrade', sendMail: sendEmail })}
              disabled={manualUpdate.isPending}
            >
              {manualUpdate.isPending ? "Processing..." : "Downgrade User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Card({ children, className, ...props }: any) {
  return <div className={`rounded-xl border shadow-sm ${className}`} {...props}>{children}</div>
}
