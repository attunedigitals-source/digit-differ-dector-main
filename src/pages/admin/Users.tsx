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
import { getAllLeads, type LeadRecord } from "@/lib/leads";
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
  

  // Fetch Users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      console.log("[AdminUsers] Fetching all users and performance stats...");
      const { data: profiles, error: perfError } = await supabase
        .from('profiles')
        .select('*, performance:admin_user_performance(*)')
        .order('created_at', { ascending: false });
      
      if (perfError) throw perfError;
      return profiles;
    },
    refetchInterval: 30000, // Auto-refresh every 30s to catch the 60s bot reports
  });

  // Real-time synchronization for the main list
  useEffect(() => {
    const channel = supabase
      .channel('admin-global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_reports' },
        () => {
          console.log("[AdminUsers] Daily report update detected. Refreshing list...");
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => queryClient.invalidateQueries({ queryKey: ["admin-users"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Fetch Captured Leads & Deriv Mappings
  const { data: leads = [] } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: () => getAllLeads(),
    refetchInterval: 10000,
  });

  const filteredUsers = users?.filter(u => u.email.toLowerCase().includes(search.toLowerCase())) || [];

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <Tabs defaultValue="all-users" className="w-full">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-card/50">
              <TabsTrigger value="all-users" className="text-xs">All Users ({users?.length || 0})</TabsTrigger>
              <TabsTrigger value="captured-leads" className="text-xs">
                Leads & Deriv Mapping ({leads.length})
              </TabsTrigger>
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
                    <TableHead className="text-xs">Trial Status</TableHead>
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
                        {u.subscription_status === 'free' && u.trial_started_at ? (
                          (() => {
                            const startTime = new Date(u.trial_started_at).getTime();
                            const durationMs = u.trial_duration_days * 24 * 60 * 60 * 1000;
                            const expiryTime = startTime + durationMs;
                            const now = new Date().getTime();
                            const diff = expiryTime - now;
                            
                            if (diff <= 0) return <span className="text-[10px] text-destructive font-bold uppercase">Expired</span>;
                            
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            return (
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-medium text-blue-400">{days}d {hours}h left</span>
                                <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500" 
                                    style={{ width: `${Math.max(0, Math.min(100, (diff / durationMs) * 100))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()
                        ) : u.subscription_status === 'active' ? (
                          <Badge variant="outline" className="text-[9px] bg-green-500/5 text-green-500 border-green-500/20">UNLIMITED</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            // Aggregate stats across all accounts (old and new logins)
                            const perf = u.performance || [];
                            const totalTrades = perf.reduce((sum: number, p: any) => sum + (p.total_trades || 0), 0);
                            const netProfit = perf.reduce((sum: number, p: any) => sum + (Number(p.net_profit) || 0), 0);
                            const todayProfit = perf.reduce((sum: number, p: any) => sum + (Number(p.today_profit) || 0), 0);
                            const isActive = perf.some((p: any) => p.is_active_now);

                            return (
                              <>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <Activity className={`w-3 h-3 ${isActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                                  <span className="font-medium">{totalTrades} Trades</span>
                                  {perf.length > 1 && (
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0 bg-primary/5 text-primary border-primary/20">
                                      {perf.length} Accounts
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  { netProfit >= 0 ? (
                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3 text-destructive" />
                                  )}
                                  <span className={`font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                    ${netProfit.toFixed(2)}
                                  </span>
                                  {todayProfit !== 0 && (
                                    <span className={`text-[9px] font-medium ${todayProfit > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                                      ({todayProfit > 0 ? '+' : ''}{todayProfit.toFixed(1)})
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
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
                                  // Auto-select requested plan if it exists
                                  const pendingPayment = payments?.find(p => p.user_id === u.id);
                                  if (pendingPayment) {
                                    setSelectedPlan(pendingPayment.plan_type as PlanType);
                                  } else {
                                    setSelectedPlan("1_month");
                                  }
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

          <TabsContent value="captured-leads">
            <Card className="border-border bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs">Lead Email & Name</TableHead>
                    <TableHead className="text-xs">WhatsApp Phone</TableHead>
                    <TableHead className="text-xs">Traffic Source</TableHead>
                    <TableHead className="text-xs">Matched Deriv Account ID</TableHead>
                    <TableHead className="text-xs">Date Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                        No captured leads found yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads
                      .filter((l) =>
                        !search ||
                        l.email?.toLowerCase().includes(search.toLowerCase()) ||
                        l.phone?.includes(search) ||
                        l.deriv_loginid?.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((l, index) => (
                        <TableRow key={index} className="border-border/50 hover:bg-muted/20">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm text-foreground">{l.email}</span>
                              {l.name && <span className="text-xs text-muted-foreground">{l.name}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-emerald-400 font-semibold">{l.phone}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                l.source === "tiktok_paid"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                              }
                            >
                              {l.source === "tiktok_paid" ? "TikTok Paid Ad" : "Organic Direct"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {l.deriv_loginid ? (
                              <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-xs">
                                {l.deriv_loginid}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground bg-muted/40 text-[10px]">
                                Unmatched (Pending Login)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(l.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
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
              <div className="flex justify-between items-center">
                <Label>Select Subscription Plan</Label>
                {payments?.find(p => p.user_id === selectedUser?.id) && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                    Requested: {payments.find(p => p.user_id === selectedUser?.id)?.plan_type.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <Select value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)}>
                <SelectTrigger className={`bg-background border-border ${payments?.find(p => p.user_id === selectedUser?.id) ? "ring-1 ring-primary/50" : ""}`}>
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
