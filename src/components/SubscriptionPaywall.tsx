import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PLANS = [
  {
    id: "1_month",
    name: "1 Month",
    price: 45,
    description: "Perfect for testing the strategy",
    features: ["Real Account Trading", "All Volatilities", "24/7 Support", "1 Device Limit"],
    icon: Zap,
  },
  {
    id: "6_months",
    name: "6 Months",
    price: 240,
    description: "Best for consistent traders",
    features: ["Real Account Trading", "All Volatilities", "Priority Support", "2 Device Limit", "Save $30"],
    icon: ShieldCheck,
    popular: true,
  },
  {
    id: "12_months",
    name: "12 Months",
    price: 400,
    description: "The ultimate trading setup",
    features: ["Real Account Trading", "All Volatilities", "VIP Direct Support", "3 Device Limit", "Save $140"],
    icon: Sparkles,
  },
];

interface SubscriptionPaywallProps {
  onClose?: () => void;
}

export function SubscriptionPaywall({ onClose }: SubscriptionPaywallProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!user) return;
    setLoading(true);
    setSelectedPlan(planId);

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

      toast.success("Subscription request sent! Please contact Admin for payment verification.");
      if (refreshProfile) await refreshProfile();
      if (onClose) onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate subscription");
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

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
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
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
              {loading && selectedPlan === plan.id ? (
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
