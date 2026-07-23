import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, MessageSquare, CheckCircle2, ArrowRight, Shield, Award, Sparkles } from "lucide-react";
import { submitLead } from "@/lib/leads";
import { toast } from "sonner";

export const TikTokLanding: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !phone) {
      toast.error("Please enter both your email address and WhatsApp phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLead({
        email,
        phone,
        name,
        source: "tiktok_paid",
        whatsappOptIn: true,
      });

      toast.success("Successfully registered! Redirecting to confirmation page...");
      navigate("/thank-you-2");
    } catch (error) {
      console.error(error);
      toast.error("Failed to register lead. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Digit Bot <span className="text-primary">Pro</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> TikTok VIP Access
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-12">
        {/* Left Value Proposition Column */}
        <div className="flex-1 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            Exclusive TikTok Community & Tool Access
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Join the Exclusive <span className="text-primary">VIP WhatsApp Group</span> & Launch Digit Bot Pro
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Register to get access to automated Deriv trading tool with its real-time ensemble analytics, and our active WhatsApp community.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/90 font-medium">Instant Access to Digit Bot Pro Trading Tool Algorithms</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/90 font-medium">Seamless Deriv Account Integration</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/90 font-medium">Free WhatsApp Group Support & Trade Updates</span>
            </div>
          </div>

          <div className="pt-4 flex items-center gap-6 text-xs text-muted-foreground border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-primary" /> 100% Encrypted & Safe
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" /> Verified TikTok Partner Flow
            </div>
          </div>
        </div>

        {/* Right Lead Capture Form Card */}
        <div className="w-full md:w-[420px]">
          <Card className="border border-primary/30 bg-card/90 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="space-y-1 text-left pb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 border border-emerald-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Get Instant VIP Access</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your details below to join our WhatsApp group and proceed to app login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80">Full Name (Optional)</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80">Email Address <span className="text-red-400">*</span></label>
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80">WhatsApp Phone Number <span className="text-red-400">*</span></label>
                  <Input
                    type="tel"
                    required
                    placeholder="+2348012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                  <span className="text-[10px] text-muted-foreground">Include country code (e.g. +234, +1, +44)</span>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 mt-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Join WhatsApp & Continue <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                <p className="text-[10px] text-center text-muted-foreground pt-2">
                  By submitting, you agree to receive WhatsApp community updates & trading signals. We respect your privacy.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-6">
          <p>© {new Date().getFullYear()} Digit Bot Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default TikTokLanding;
