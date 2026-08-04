import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, MessageSquare, CheckCircle2, ArrowRight, Award, Sparkles } from "lucide-react";
import { submitLead } from "@/lib/leads";
import { toast } from "sonner";
import { PhoneInputWithCountry } from "@/components/PhoneInputWithCountry";

export const TikTokLanding: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time Name sanitizer: allow only letters, spaces, hyphens, and apostrophes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/[^a-zA-Z\s'-]/g, "");
    setName(sanitized);
  };

  // Real-time Email sanitizer: disallow whitespace, force lowercase
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\s/g, "").toLowerCase();
    setEmail(sanitized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Full Name Validation
    const trimmedName = name.trim();
    const nameRegex = /^[a-zA-Z\s'-]{2,}$/;
    if (!trimmedName || !nameRegex.test(trimmedName)) {
      toast.error("Full Name should only contain letters and spaces (minimum 2 characters).");
      return;
    }

    // 2. Email Validation
    const trimmedEmail = email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      toast.error("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    // 3. WhatsApp Phone Validation (must include country code and valid digit count)
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    const digitsOnly = formattedPhone.replace(/\D/g, "");
    if (!phone || digitsOnly.length < 7 || digitsOnly.length > 15) {
      toast.error("Please enter a valid WhatsApp phone number including country code.");
      return;
    }

    // 4. Password Validation
    if (!password || !confirmPassword) {
      toast.error("Please create and confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please enter matching passwords.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLead({
        email: trimmedEmail,
        phone: formattedPhone,
        name: trimmedName,
        password,
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
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex-1 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Award className="w-3.5 h-3.5" /> Exclusive VIP Community Invitation
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Get Instant VIP Access To <span className="text-primary">Digit Bot Pro</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Welcome from TikTok! Fill out the quick form to claim your access to the Digit Bot Pro automation suite and join our private WhatsApp group for daily signal updates and trading strategies.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Automated Deriv Execution Algorithms</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Real-Time Ensemble Volatility Predictors</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Private WhatsApp VIP Signals & Community</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[420px]">
          <Card className="border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/10">
            <CardHeader className="space-y-1 text-left pb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 border border-primary/20">
                <MessageSquare className="w-5 h-5" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Join WhatsApp VIP</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your details below to join our WhatsApp group and proceed to app login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 text-left">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                    <span>Full Name <span className="text-red-400">*</span></span>
                    <span className="text-[10px] text-muted-foreground font-normal">Letters only</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={name}
                    onChange={handleNameChange}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                    <span>Email Address <span className="text-red-400">*</span></span>
                    <span className="text-[10px] text-muted-foreground font-normal">Valid email format</span>
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={handleEmailChange}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                {/* WhatsApp Phone Number with Flag Helper & Search */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
                    <span>WhatsApp Phone Number <span className="text-red-400">*</span></span>
                    <span className="text-[10px] text-muted-foreground font-normal">Select flag helper</span>
                  </label>
                  <PhoneInputWithCountry
                    value={phone}
                    onChange={setPhone}
                    required
                    placeholder="8012345678"
                  />
                  <span className="text-[10px] text-muted-foreground block pt-0.5">
                    Click the flag button to search your country name or code.
                  </span>
                </div>

                {/* Create Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80">Create Password <span className="text-red-400">*</span></label>
                  <Input
                    type="password"
                    required
                    placeholder="Create a password for client login"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground/80">Confirm Password <span className="text-red-400">*</span></label>
                  <Input
                    type="password"
                    required
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Join WhatsApp & Continue <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Digit Bot Pro. All rights reserved.
      </footer>
    </div>
  );
};

export default TikTokLanding;
