import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Lock, KeyRound, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Check if recovery event or token is present
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("[Auth] Password recovery event active");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter matching passwords.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(`Password update failed: ${error.message}`);
      } else {
        setIsSuccess(true);
        toast.success("Your password has been updated successfully!");
        setTimeout(() => {
          navigate("/auth");
        }, 3000);
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
            <Button variant="ghost" className="text-sm font-semibold hover:text-primary">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto px-6 py-16 flex items-center justify-center w-full">
        <Card className="w-full border-border/80 bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-2 text-primary">
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-white">
              Set New Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              Create a new secure password for your Digit Bot Pro account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isSuccess ? (
              <div className="space-y-5 text-center py-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-left">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> Password Changed Successfully
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your password has been updated. You will be redirected to the sign-in page in a few seconds...
                  </p>
                </div>

                <Link to="/auth">
                  <Button className="w-full text-xs font-bold bg-primary hover:bg-primary/90 gap-1.5">
                    Proceed to Login <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" /> New Password
                  </label>
                  <Input
                    type="password"
                    required
                    placeholder="Enter new password (min. 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-background/60 border-border/60 focus:border-primary text-xs h-10"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" /> Confirm New Password
                  </label>
                  <Input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                      <KeyRound className="w-4 h-4" /> Save New Password
                    </>
                  )}
                </Button>
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
