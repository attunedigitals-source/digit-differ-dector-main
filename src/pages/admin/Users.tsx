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
  Trash2,
  Zap,
  Tag,
  Plus,
  Percent,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCapturedLeads, manuallyLinkLeadDerivAccount, deleteLeadRecord, LeadData } from "@/lib/leads";
import { syncAllLeadsToBrevo } from "@/lib/brevo";
import {
  getAdminPromoCodes,
  createAdminPromoCode,
  toggleAdminPromoCode,
  deleteAdminPromoCode,
  PromoCode,
  PromoScope
} from "@/lib/promo";
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
  const [isSyncingBrevo, setIsSyncingBrevo] = useState(false);
  
  const queryClient = useQueryClient();

  // Auto-sync leads to Brevo on admin mount
  useEffect(() => {
    syncAllLeadsToBrevo().then((res) => {
      console.log(`[AdminUsers] Auto Brevo sync: ${res.synced}/${res.total}`);
    }).catch(console.warn);
  }, []);

  const handleBrevoSync = async () => {
    setIsSyncingBrevo(true);
    toast.info("Syncing all Supabase leads to Brevo List 3...");
    try {
      const res = await syncAllLeadsToBrevo();
      toast.success(`Successfully synced ${res.synced} / ${res.total} leads to Brevo List 3!`);
    } catch (err: any) {
      toast.error(`Brevo sync error: ${err.message || String(err)}`);
    } finally {
      setIsSyncingBrevo(false);
    }
  };

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
        { event: '*', schema: 'public', table: 'payments' },
        () => {
          console.log("[AdminUsers] Payments change detected. Refreshing...");
          queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
          queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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

  // Paid Users Filter state
  const [paidSubFilter, setPaidSubFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");

  // Promo Code Modal & Form State
  const [isCreatePromoOpen, setIsCreatePromoOpen] = useState(false);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoDiscount, setNewPromoDiscount] = useState("20");
  const [newPromoScope, setNewPromoScope] = useState<PromoScope>("trial_only");
  const [newPromoEmail, setNewPromoEmail] = useState("");
  const [newPromoExpiry, setNewPromoExpiry] = useState("");
  const [newPromoMaxUses, setNewPromoMaxUses] = useState("");

  // Fetch Promo Codes
  const { data: promoCodes, isLoading: promoLoading } = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: getAdminPromoCodes,
  });

  // Create Promo Code Mutation
  const createPromoMutation = useMutation({
    mutationFn: async () => {
      if (!newPromoCode.trim()) throw new Error("Please enter a promo code string.");
      const discount = Number(newPromoDiscount);
      if (isNaN(discount) || discount <= 0 || discount > 100) {
        throw new Error("Discount percentage must be between 1 and 100.");
      }

      return createAdminPromoCode({
        code: newPromoCode,
        discount_percent: discount,
        scope: newPromoScope,
        specific_user_email: newPromoScope === "specific_user" ? newPromoEmail : null,
        expires_at: newPromoExpiry ? new Date(newPromoExpiry).toISOString() : null,
        max_uses: newPromoMaxUses ? Number(newPromoMaxUses) : null,
      });
    },
    onSuccess: (data) => {
      toast.success(`Discount code "${data.code}" (${data.discount_percent}% OFF) generated!`);
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
      setIsCreatePromoOpen(false);
      setNewPromoCode("");
      setNewPromoDiscount("20");
      setNewPromoScope("trial_only");
      setNewPromoEmail("");
      setNewPromoExpiry("");
      setNewPromoMaxUses("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create discount code.");
    }
  });

  // Toggle Promo Active State
  const togglePromoMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await toggleAdminPromoCode(id, is_active);
    },
    onSuccess: () => {
      toast.success("Promo code status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status.");
    }
  });

  // Delete Promo Code
  const deletePromoMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteAdminPromoCode(id);
    },
    onSuccess: () => {
      toast.success("Promo code deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete promo code.");
    }
  });

  const exportLeadsCSV = (leadsList?: LeadData[]) => {
    if (!leadsList || leadsList.length === 0) {
      toast.error("No lead records available to export.");
      return;
    }
    const headers = ["User ID", "Full Name / Display Name", "Email Address", "Phone Number", "Connected Deriv Account", "Deriv Accounts List", "RState Token", "Source", "Date Registered"];
    const rows = leadsList.map(l => [
      `"${l.userId || "N/A"}"`,
      `"${l.name || (l.email ? l.email.split("@")[0] : "")}"`,
      `"${l.email || ""}"`,
      `"${l.phone || ""}"`,
      `"${l.derivLoginId || "Not Connected Yet"}"`,
      `"${(l.derivAccounts || []).join(", ")}"`,
      `"${l.rstate || "Active"}"`,
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
        subscription_expiry: expiry.toISOString(),
        has_ever_paid: true,
      } as any).eq('id', userId);

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
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    }
  });

  // Mutation to Reject Payment
  const rejectPayment = useMutation({
    mutationFn: async ({ paymentId, userId }: { paymentId: string; userId: string }) => {
      // 1. Update payment status to 'rejected'
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', paymentId);
      
      if (paymentError) throw paymentError;

      // 2. Revert user profile subscription_status from 'pending' back to 'free' so they can retry payment
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ subscription_status: 'free' })
        .eq('id', userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast.success("Payment request rejected. User can now retry payment.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject payment");
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
          subscription_expiry: expiry.toISOString(),
          has_ever_paid: true,
        } as any).eq('id', userId);
        
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

  // Exclude Admin account (amusco2@yahoo.com) from User Management display
  const ADMIN_EMAIL = "amusco2@yahoo.com";
  const clientUsers = users?.filter(u => u.email?.toLowerCase() !== ADMIN_EMAIL) || [];
  const filteredUsers = clientUsers.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  // Categorize Paid Users (Once a trial member has paid once, they permanently remain in paidUsers)
  const paidUsers = clientUsers.filter(u => Boolean(u.has_ever_paid || u.subscription_status === 'active'));
  const subscribedPaidUsers = paidUsers.filter(u => u.subscription_status === 'active');
  const unsubscribedPaidUsers = paidUsers.filter(u => u.subscription_status !== 'active');

  const filteredPaidUsers = paidUsers.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (paidSubFilter === "subscribed") return u.subscription_status === "active";
    if (paidSubFilter === "unsubscribed") return u.subscription_status !== "active";
    return true;
  });

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">
        <Tabs defaultValue="all-users" className="w-full">
          <div className="flex items-center justify-between mb-2">
            <TabsList className="bg-card/50">
              <TabsTrigger value="all-users" className="text-xs">All Users ({clientUsers.length})</TabsTrigger>
              <TabsTrigger value="paid-users" className="text-xs font-semibold text-emerald-400">
                Paid Users ({paidUsers.length})
              </TabsTrigger>
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
              <TabsTrigger value="discount-codes" className="text-xs font-semibold text-purple-400">
                <Tag className="w-3.5 h-3.5 mr-1" />
                Discount Codes ({promoCodes?.length || 0})
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
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-xs text-foreground">{u.full_name || u.name || (u.email ? u.email.split("@")[0] : "Client")}</span>
                          <Link 
                            to={`/admin/users/${u.id}`}
                            className="font-mono text-xs flex items-center gap-1 hover:text-primary transition-colors text-primary font-medium"
                          >
                             {u.email}
                             <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          {u.phone && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                              <Phone className="w-2.5 h-2.5 text-green-500" /> {u.phone}
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[150px]">{u.user_id || u.id}</span>
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
                          onClick={() => rejectPayment.mutate({ paymentId: p.id, userId: p.user_id })}
                          disabled={rejectPayment.isPending || approvePayment.isPending}
                        >
                          <XCircle className="w-4 h-4 mr-1" /> {rejectPayment.isPending ? "Rejecting..." : "Reject"}
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/30"
                          onClick={() => approvePayment.mutate({ paymentId: p.id, userId: p.user_id, planType: p.plan_type })}
                          disabled={approvePayment.isPending || rejectPayment.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" /> {approvePayment.isPending ? "Approving..." : "Approve"}
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
                    Registered Users & Captured Leads Directory
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                      {capturedLeads?.length || 0} Total
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Complete directory of registered users, RState tokens, contact details, and connected Deriv account IDs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSyncingBrevo}
                    onClick={handleBrevoSync}
                    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs gap-1.5 font-semibold"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    {isSyncingBrevo ? "Syncing Brevo..." : "Sync All to Brevo"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => exportLeadsCSV(capturedLeads)}
                    className="bg-primary text-primary-foreground text-xs gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Leads CSV
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs font-mono font-bold text-primary">User ID</TableHead>
                    <TableHead className="text-xs font-semibold">Full Name / Display Name</TableHead>
                    <TableHead className="text-xs font-semibold">Email Address</TableHead>
                    <TableHead className="text-xs font-semibold">Phone Number</TableHead>
                    <TableHead className="text-xs font-semibold">Connected Deriv Account(s)</TableHead>
                    <TableHead className="text-xs font-mono font-bold text-purple-400">RState Token</TableHead>
                    <TableHead className="text-xs font-semibold">Traffic Source</TableHead>
                    <TableHead className="text-xs font-semibold">Date Registered</TableHead>
                    <TableHead className="text-xs text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-xs">
                        Loading captured leads...
                      </TableCell>
                    </TableRow>
                  ) : capturedLeads?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-xs italic">
                        No captured leads found yet. Submit a registration at /lp2 or /register to test.
                      </TableCell>
                    </TableRow>
                  ) : (
                    capturedLeads
                      ?.filter((l) =>
                        (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
                        (l.phone || "").includes(search) ||
                        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
                        (l.userId || "").toLowerCase().includes(search.toLowerCase()) ||
                        (l.derivLoginId || "").toLowerCase().includes(search.toLowerCase())
                      )
                      .map((lead, idx) => {
                        const cleanPhone = (lead.phone || "").replace(/[^\d+]/g, "");
                        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace("+", "")}` : null;
                        const fullName = lead.name || (lead.email ? lead.email.split("@")[0] : "N/A");

                        // Extract all accounts (Real vs Demo)
                        const accountsList: string[] = [];
                        if (Array.isArray(lead.derivAccounts)) {
                          lead.derivAccounts.forEach((acc) => {
                            if (acc && !accountsList.includes(acc)) accountsList.push(acc);
                          });
                        }
                        if (lead.derivLoginId && !accountsList.includes(lead.derivLoginId)) {
                          accountsList.unshift(lead.derivLoginId);
                        }

                        return (
                          <TableRow key={lead.email + idx} className="border-border/50 hover:bg-muted/20">
                            <TableCell className="text-xs font-mono font-semibold text-primary">
                              {lead.userId || "N/A"}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">
                              {fullName}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-primary">
                              {lead.email}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {lead.phone ? (
                                <span className="flex items-center gap-1.5 text-foreground font-semibold">
                                  <Phone className="w-3 h-3 text-green-500" />
                                  {lead.phone}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">Not Provided</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {accountsList.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1 max-w-[260px]">
                                  {accountsList.map((accId) => {
                                    const isDemo = accId.toUpperCase().startsWith("VR");
                                    return (
                                      <Badge
                                        key={accId}
                                        variant="outline"
                                        className={
                                          isDemo
                                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] font-bold"
                                            : "bg-green-500/10 text-green-500 border-green-500/20 text-[10px] font-bold"
                                        }
                                      >
                                        {isDemo ? `DEMO: ${accId}` : `REAL: ${accId}`}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              ) : (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                  Pending Connection
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {lead.rstate ? (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-mono">
                                  {lead.rstate}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px]">Active</span>
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

          {/* Paid Users Categorized Tab */}
          <TabsContent value="paid-users">
            <Card className="border-border bg-card/40 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    Categorized Paid Users Directory
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs font-bold">
                      {paidUsers.length} Total Ever Paid
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Directory of users who have converted to paid subscriptions. Includes active subscribers and past paid members.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={paidSubFilter === "all" ? "default" : "outline"}
                    onClick={() => setPaidSubFilter("all")}
                    className="text-xs h-8"
                  >
                    All Paid ({paidUsers.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={paidSubFilter === "subscribed" ? "default" : "outline"}
                    onClick={() => setPaidSubFilter("subscribed")}
                    className="text-xs h-8 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10"
                  >
                    Subscribed ({subscribedPaidUsers.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={paidSubFilter === "unsubscribed" ? "default" : "outline"}
                    onClick={() => setPaidSubFilter("unsubscribed")}
                    className="text-xs h-8 text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                  >
                    Not Subscribed ({unsubscribedPaidUsers.length})
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Paid Status</TableHead>
                    <TableHead className="text-xs">Plan Expiry</TableHead>
                    <TableHead className="text-xs">Lifetime Perf</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPaidUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs italic">
                        No paid users found matching current filter
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPaidUsers.map((u) => {
                      const isSubscribed = u.subscription_status === 'active';
                      return (
                        <TableRow key={u.id} className="border-border/50 hover:bg-muted/20">
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-xs text-foreground">{u.full_name || u.name || u.email.split("@")[0]}</span>
                              <Link to={`/admin/users/${u.id}`} className="font-mono text-xs text-primary flex items-center gap-1 hover:underline">
                                {u.email} <ArrowUpRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSubscribed ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold text-[10px] uppercase">
                                ● Subscribed (Active)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold text-[10px] uppercase">
                                ○ Not Subscribed (Expired)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {u.subscription_expiry ? new Date(u.subscription_expiry).toLocaleDateString() : 'Expired'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(() => {
                              const perf = u.performance || [];
                              const netProfit = perf.reduce((sum: number, p: any) => sum + (Number(p.net_profit) || 0), 0);
                              return (
                                <span className={`font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                  ${netProfit.toFixed(2)}
                                </span>
                              );
                            })()}
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
                                {!isSubscribed ? (
                                  <DropdownMenuItem 
                                    className="text-xs gap-2 cursor-pointer"
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setSelectedPlan("1_month");
                                      setIsUpgradeOpen(true);
                                    }}
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-green-500" /> Renew / Upgrade Paid
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
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Discount Codes Management Tab */}
          <TabsContent value="discount-codes">
            <Card className="border-border bg-card/40 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-400" />
                    Discount & Promo Code Generator
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">
                      {promoCodes?.length || 0} Codes Configured
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Generate percentage discount codes e.g. <span className="font-mono font-bold text-primary">PRO20</span> (20% off for first-time trial users) or custom targeted promo codes with expiration periods.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => setIsCreatePromoOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5 shadow-sm font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Generate Discount Code
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs font-mono font-bold text-purple-400">Promo Code</TableHead>
                    <TableHead className="text-xs font-semibold">Discount %</TableHead>
                    <TableHead className="text-xs font-semibold">Target Audience Scope</TableHead>
                    <TableHead className="text-xs font-semibold">Expiration</TableHead>
                    <TableHead className="text-xs font-semibold">Usage</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promoLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                        Loading promo codes...
                      </TableCell>
                    </TableRow>
                  ) : promoCodes?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs italic">
                        No discount codes generated yet. Click "Generate Discount Code" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    promoCodes?.map((pc) => {
                      const isExpired = pc.expires_at ? new Date(pc.expires_at).getTime() < Date.now() : false;

                      return (
                        <TableRow key={pc.id} className="border-border/50 hover:bg-muted/20">
                          <TableCell className="font-mono text-sm font-bold text-purple-400 tracking-wider">
                            {pc.code}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold text-xs">
                              {pc.discount_percent}% OFF
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {pc.scope === "trial_only" ? (
                              <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                                First-Time Trial Users Only
                              </Badge>
                            ) : pc.scope === "paid_only" ? (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                Paid Users Only
                              </Badge>
                            ) : pc.scope === "specific_user" ? (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                User: {pc.specific_user_email}
                              </span>
                            ) : (
                              <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                                All Users
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {pc.expires_at ? (
                              <span className={isExpired ? "text-destructive font-bold" : "text-foreground"}>
                                {new Date(pc.expires_at).toLocaleString()} {isExpired && "(Expired)"}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground">No Expiration</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {pc.times_used} uses {pc.max_uses ? `/ Max ${pc.max_uses}` : "(Unlimited)"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`cursor-pointer text-[10px] uppercase font-bold transition-colors ${
                                pc.is_active && !isExpired
                                  ? "bg-green-500/10 text-green-500 border-green-500/30" 
                                  : "bg-muted text-muted-foreground"
                              }`}
                              onClick={() => togglePromoMutation.mutate({ id: pc.id, is_active: !pc.is_active })}
                            >
                              {pc.is_active && !isExpired ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete promo code"
                              onClick={() => {
                                if (window.confirm(`Delete promo code "${pc.code}"?`)) {
                                  deletePromoMutation.mutate(pc.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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

      {/* Create Promo Code Dialog */}
      <Dialog open={isCreatePromoOpen} onOpenChange={setIsCreatePromoOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-400" /> Generate New Discount Code
            </DialogTitle>
            <DialogDescription>
              Create a promo code with percentage discount, scope, and optional expiration period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Promo Code String</Label>
              <Input 
                placeholder="e.g. PRO20, SUMMER30, VIP50"
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                className="font-mono uppercase text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Discount Percentage (%)</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  min="1"
                  max="100"
                  placeholder="20"
                  value={newPromoDiscount}
                  onChange={(e) => setNewPromoDiscount(e.target.value)}
                  className="font-mono text-xs"
                />
                <span className="text-sm font-bold text-emerald-400">% OFF</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Target Audience Scope</Label>
              <Select value={newPromoScope} onValueChange={(val: PromoScope) => setNewPromoScope(val)}>
                <SelectTrigger className="text-xs bg-background">
                  <SelectValue placeholder="Select target scope" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="trial_only">First-Time Trial Users Only (Restricted from Paid Users)</SelectItem>
                  <SelectItem value="paid_only">Paid / Existing Subscribers Only</SelectItem>
                  <SelectItem value="all">All Users (Trial + Paid)</SelectItem>
                  <SelectItem value="specific_user">Specific Individual User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPromoScope === "specific_user" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">User Email Address</Label>
                <Input 
                  placeholder="e.g. client@example.com"
                  value={newPromoEmail}
                  onChange={(e) => setNewPromoEmail(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Expiration Date (Optional)</Label>
                <Input 
                  type="datetime-local"
                  value={newPromoExpiry}
                  onChange={(e) => setNewPromoExpiry(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Max Uses Limit (Optional)</Label>
                <Input 
                  type="number"
                  placeholder="Unlimited"
                  value={newPromoMaxUses}
                  onChange={(e) => setNewPromoMaxUses(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreatePromoOpen(false)}>Cancel</Button>
            <Button 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              disabled={createPromoMutation.isPending || !newPromoCode.trim()}
              onClick={() => createPromoMutation.mutate()}
            >
              {createPromoMutation.isPending ? "Generating..." : "Generate Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
