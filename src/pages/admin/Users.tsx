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
  ArrowUpRight,
  Download,
  Phone,
  MessageSquare,
  Link2,
  Trash2
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCapturedLeads, manuallyLinkLeadDerivAccount, deleteLeadRecord, LeadData } from "@/lib/leads";
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

  // Manual Deriv Account Link Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedLeadForLink, setSelectedLeadForLink] = useState<LeadData | null>(null);
  const [customDerivId, setCustomDerivId] = useState("");
  
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

  // Real-time synchronization for users, leads, and daily reports
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
        () => {
          console.log("[AdminUsers] Profiles change/deletion detected. Refreshing...");
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          queryClient.invalidateQueries({ queryKey: ["admin-captured-leads"] });
          queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          console.log("[AdminUsers] Leads change/deletion detected. Refreshing...");
          queryClient.invalidateQueries({ queryKey: ["admin-captured-leads"] });
          queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch Pending Payments
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

  // Fetch Captured Leads
  const { data: capturedLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ["admin-captured-leads"],
    queryFn: getCapturedLeads,
    refetchInterval: 15000,
  });

  const exportLeadsCSV = (leadsList?: LeadData[]) => {
    if (!leadsList || leadsList.length === 0) {
      toast.error("No lead records available to export.");
      return;
    }
    const headers = ["Full Name", "Email", "WhatsApp Phone", "Connected Deriv Account", "Deriv Accounts List", "Source", "Date Captured"];
    const rows = leadsList.map(l => [
      `"${l.name || ""}"`,
      `"${l.email || ""}"`,
      `"${l.phone || ""}"`,
      `"${l.derivLoginId || "Not Connected Yet"}"`,
      `"${(l.derivAccounts || []).join(", ")}"`,
      `"${l.source === "tiktok_paid" ? "TikTok Paid (LP2)" : "Organic Direct"}"`,
      `"${new Date(l.createdAt || Date.now()).toLocaleString()}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `digit_bot_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Captured leads exported to CSV!");
  };

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
              <TabsTrigger value="captured-leads" className="text-xs font-semibold text-primary">
                Captured Leads ({capturedLeads?.length || 0})
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
            <Card className="border-border bg-card/40 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    TikTok & Organic Lead Registrations
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {capturedLeads?.length || 0} Total
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Contact information captured from LP2 TikTok Ads and direct registration.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => exportLeadsCSV(capturedLeads)}
                  className="bg-primary text-primary-foreground text-xs gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Export Leads CSV
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs">Full Name</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">WhatsApp Phone</TableHead>
                    <TableHead className="text-xs">Connected Deriv Account</TableHead>
                    <TableHead className="text-xs">Traffic Source</TableHead>
                    <TableHead className="text-xs">Date Captured</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        Loading captured leads...
                      </TableCell>
                    </TableRow>
                  ) : capturedLeads?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs italic">
                        No captured leads found yet. Submit a registration at /lp2 or /register to test.
                      </TableCell>
                    </TableRow>
                  ) : (
                    capturedLeads
                      ?.filter((l) =>
                        (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
                        (l.phone || "").includes(search) ||
                        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
                        (l.derivLoginId || "").toLowerCase().includes(search.toLowerCase())
                      )
                      .map((lead, idx) => {
                        const cleanPhone = (lead.phone || "").replace(/[^\d+]/g, "");
                        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : null;

                        return (
                          <TableRow key={lead.email + idx} className="border-border/50 hover:bg-muted/20">
                            <TableCell className="text-sm font-medium text-foreground">
                              {lead.name || "N/A"}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-primary">
                              {lead.email}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                               <span className="flex items-center gap-1.5">
                                 <Phone className="w-3 h-3 text-muted-foreground" />
                                 {lead.phone || "N/A"}
                               </span>
                             </TableCell>
                            <TableCell className="text-xs font-mono">
                               {lead.derivLoginId ? (
                                 <div className="flex items-center gap-1.5">
                                   <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] font-bold">
                                     {lead.derivLoginId}
                                   </Badge>
                                   <Button
                                     size="icon"
                                     variant="ghost"
                                     className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                     title="Change Connected Deriv Account"
                                     onClick={() => {
                                       setSelectedLeadForLink(lead);
                                       setCustomDerivId(lead.derivLoginId || "");
                                       setIsLinkModalOpen(true);
                                     }}
                                   >
                                     <Link2 className="w-3 h-3" />
                                   </Button>
                                 </div>
                               ) : (
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   className="h-6 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/10"
                                   onClick={() => {
                                     setSelectedLeadForLink(lead);
                                     setCustomDerivId("");
                                     setIsLinkModalOpen(true);
                                   }}
                                 >
                                   <Link2 className="w-3 h-3" /> Link Account
                                 </Button>
                               )}
                             </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-semibold ${
                                  lead.source === "tiktok_paid"
                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                }`}
                              >
                                {lead.source === "tiktok_paid" ? "TikTok Ads (LP2)" : "Organic Direct"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(lead.createdAt || Date.now()).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {waUrl && (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-green-500 hover:text-green-400 font-semibold transition-colors"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                  </a>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Delete lead record"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to delete lead record for ${lead.email}?`)) {
                                      const ok = await deleteLeadRecord(lead.email);
                                      if (ok) {
                                        toast.success(`Deleted lead ${lead.email}`);
                                        queryClient.invalidateQueries({ queryKey: ["admin-captured-leads"] });
                                        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                                        queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
                                      } else {
                                        toast.error(`Failed to delete lead ${lead.email}`);
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
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

      {/* Link Deriv Account Dialog */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Link2 className="w-4 h-4 text-primary" /> Link Deriv Account
            </DialogTitle>
            <DialogDescription>
              Assign a Deriv Account ID to captured lead <span className="font-semibold text-primary">{selectedLeadForLink?.email}</span> ({selectedLeadForLink?.name || "N/A"})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Existing Deriv Profile User</Label>
              <Select
                value={customDerivId}
                onValueChange={(val) => setCustomDerivId(val)}
              >
                <SelectTrigger className="bg-background border-border text-xs">
                  <SelectValue placeholder="-- Choose from active Deriv users --" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-48">
                  {users?.map((u: any) => {
                    let derivId = u.email;
                    if (u.email && u.email.endsWith("@deriv-user.local")) {
                      derivId = u.email.split("@")[0].toUpperCase();
                    }
                    return (
                      <SelectItem key={u.id} value={derivId} className="text-xs">
                        {derivId} {u.email !== derivId ? `(${u.email})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border/60"></div>
              <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase font-bold">Or Enter Custom ID</span>
              <div className="flex-grow border-t border-border/60"></div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Deriv CR / VR Login ID</Label>
              <Input
                placeholder="e.g. CR92012918 or VRTC123456"
                value={customDerivId}
                onChange={(e) => setCustomDerivId(e.target.value)}
                className="bg-background border-border text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLinkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground font-semibold"
              onClick={async () => {
                if (!selectedLeadForLink || !customDerivId.trim()) {
                  toast.error("Please select or enter a valid Deriv Account ID");
                  return;
                }
                const success = await manuallyLinkLeadDerivAccount(selectedLeadForLink.email, customDerivId.trim());
                if (success) {
                  toast.success(`Linked ${selectedLeadForLink.email} to Deriv Account ${customDerivId.trim()}`);
                  queryClient.invalidateQueries({ queryKey: ["admin-captured-leads"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
                  setIsLinkModalOpen(false);
                  setSelectedLeadForLink(null);
                  setCustomDerivId("");
                } else {
                  toast.error("Failed to link Deriv Account");
                }
              }}
            >
              Save & Link Account
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
