import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ShieldCheck, Zap, Copy, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";

const PLANS = [
  {
    id: "1_month",
    name: "1 Month",
    price: 500,
    description: "Perfect for testing the strategy",
    features: ["Real Account Automation", "All Volatilities", "24/7 Support"],
    icon: Zap,
  },
  {
    id: "6_months",
    name: "6 Months",
    price: 2400,
    description: "Best for consistent users",
    features: ["Real Account Automation", "All Volatilities", "Priority Support", "Save $600"],
    icon: ShieldCheck,
    popular: true,
  },
  {
    id: "12_months",
    name: "12 Months",
    price: 4000,
    description: "The ultimate automation setup",
    features: ["Real Account Automation", "All Volatilities", "VIP Direct Support", "Save $2,000"],
    icon: Sparkles,
  },
];

const USDT_ADDRESS = "TEtFRiJ3Ar1jvLbu54ZkGLkswFrUc5VesD";
const ADMIN_TELEGRAM = "https://t.me/Blade234";

interface SubscriptionPaywallProps {
  onClose?: () => void;
}

export function SubscriptionPaywall({ onClose }: SubscriptionPaywallProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const handleSubscribe = async (planId: string) => {
    if (!user) return;
    setLoading(true);
    setSelectedPlanId(planId);

    try {
      const plan = PLANS.find((p) => p.id === planId);
      if (!plan) throw new Error("Invalid plan");

      // Create a pending payment record
      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        amount: plan.price,
        plan_type: planId,
        status: "pending",
      });

      if (error) throw error;

      // Update profile status to pending
      await supabase.from("profiles").update({
        subscription_status: "pending",
      }).eq("id", user.id);

      if (refreshProfile) await refreshProfile();
      setShowPayment(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate subscription");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = () => {
    if (!hasConfirmed) {
      toast.error("Please check the box to confirm your transfer.");
      return;
    }
    toast.success("Thank you! Your account will be activated once the admin verifies the transfer.");
    if (onClose) onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied to clipboard!");
  };

  if (showPayment && selectedPlanId) {
    const plan = PLANS.find(p => p.id === selectedPlanId);
    return (
      <Card className="max-w-xl mx-auto border-primary/20 shadow-2xl bg-card overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <CardHeader className="space-y-1">
          <div className="flex justify-between items-center mb-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Step 2: Payment</Badge>
            <span className="text-xs text-muted-foreground">Order: #{Math.random().toString(36).substring(7).toUpperCase()}</span>
          </div>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Complete Your Subscription
          </CardTitle>
          <CardDescription className="text-base">
            You've selected the <span className="font-bold text-foreground">{plan?.name}</span> plan for <span className="font-bold text-foreground">${plan?.price}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-5 rounded-xl bg-muted/50 border border-border space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                USDT TRON (TRC20) ADDRESS
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-background font-mono text-xs p-3 rounded-lg border border-border break-all flex items-center justify-between group">
                  <span className="text-foreground">{USDT_ADDRESS}</span>
                </div>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-10 w-10 shrink-0 hover:bg-primary hover:text-white transition-colors"
                  onClick={() => copyToClipboard(USDT_ADDRESS)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <ExternalLink className="w-4 h-4 text-primary" />
                <p className="text-sm">
                  Network: <span className="font-bold text-primary">TRON (TRC20)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-border bg-background">
              <div className="mt-1">
                <Checkbox 
                  id="confirm-transfer" 
                  checked={hasConfirmed} 
                  onCheckedChange={(checked) => setHasConfirmed(checked as boolean)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
              <label 
                htmlFor="confirm-transfer" 
                className="text-sm font-medium leading-relaxed cursor-pointer select-none"
              >
                I have sent exactly <span className="font-bold">${plan?.price} USDT</span> to the address above via the TRC20 network.
              </label>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90" 
                onClick={handlePaymentConfirmed}
                disabled={!hasConfirmed}
              >
                I have made the transfer
              </Button>
              
              <a 
                href={ADMIN_TELEGRAM} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Contact Admin on Telegram
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 border-t py-4 justify-center">
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-medium">
            Activation typically takes 5-15 minutes after verification
          </p>
        </CardFooter>
      </Card>
    );
  }

  if (profile?.subscription_status === 'pending') {
    return (
      <Card className="max-w-md mx-auto border-primary/20 bg-muted/30">
        <CardHeader className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <CardTitle>Approval Pending</CardTitle>
          <CardDescription>
            Your subscription request is being reviewed. Access will be granted once payment is verified by an admin.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <div className="w-full flex flex-col gap-3">
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
            <a 
              href={ADMIN_TELEGRAM} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button variant="ghost" className="w-full text-xs text-muted-foreground flex items-center justify-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Contact Admin
              </Button>
            </a>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto p-4">
      {PLANS.map((plan) => (
        <Card 
          key={plan.id} 
          className={`relative border-border flex flex-col transition-all hover:border-primary/50 hover:shadow-lg ${
            plan.popular ? "border-primary shadow-md ring-1 ring-primary/20" : ""
          }`}
        >
          {plan.popular && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">
              Most Popular
            </Badge>
          )}
          <CardHeader>
            <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center mb-2">
              <plan.icon className="w-5 h-5 text-primary" />
            </div>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">${plan.price}</span>
              <span className="text-muted-foreground text-sm">USD</span>
            </div>
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full font-semibold" 
              variant={plan.popular ? "default" : "outline"}
              onClick={() => handleSubscribe(plan.id)}
              disabled={loading}
            >
              {loading && selectedPlanId === plan.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Select Plan
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

