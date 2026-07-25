import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Mail, ArrowLeft, Send, CheckCircle2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(`Reset request error: ${error.message}`);
      } else {
        setIsSubmitted(true);
        toast.success("Password reset instructions sent to your email!");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Digit Bot <span className="text-primary">Pro</span>
            </span>
          </Link>
          <Link to="/auth">
            <Button variant="ghost" className="text-sm font-semibold hover:text-primary gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto px-6 py-16 flex items-center justify-center w-full">
        <Card className="w-full border-border/80 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-2 text-primary">
              <Mail className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-white">
              Reset Your Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Enter your registered email address and we'll send you a secure link to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isSubmitted ? (
              <div className="space-y-5 text-center py-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-left">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> Link Sent Successfully
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We sent a password recovery link to <span className="text-white font-medium">{email}</span>. Please check your inbox and spam folder.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    onClick={() => setIsSubmitted(false)}
                    variant="outline"
                    className="w-full text-xs font-semibold"
                  >
                    Resend Email / Use Different Email
                  </Button>
                  <Link to="/auth">
                    <Button className="w-full text-xs font-bold bg-primary hover:bg-primary/90">
                      Return to Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" /> Registered Email Address
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary text-xs h-10"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Reset Link
                    </>
                  )}
                </Button>

                <div className="pt-4 border-t border-border/40 text-center">
                  <p className="text-[11px] text-muted-foreground">
                    Need urgent help?{" "}
                    <a
                      href="https://wa.me/2348000000000"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" /> Contact Support on WhatsApp
                    </a>
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Digit Bot Pro. All rights reserved.
      </footer>
    </div>
  );
};
