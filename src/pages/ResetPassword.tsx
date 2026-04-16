import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KeyRound, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checkFinished, setCheckFinished] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRecovery = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      const type = hashParams.get("type") || queryParams.get("type");
      const accessToken = hashParams.get("access_token") || queryParams.get("access_token");

      if (type === "recovery" || accessToken) {
        setIsRecovery(true);
      }
      setCheckFinished(true);
    };

    checkRecovery();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log("Auth event in ResetPassword:", event);
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(true); // Keep loading to prevent double submit during nav
      setTimeout(() => setLoading(false), 2000);
    }
  };

  if (!checkFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary font-mono">DIGIT DIFFERS</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Invalid Reset Link</h1>
          <p className="text-muted-foreground">This link is invalid or has expired. Please request a new password reset.</p>
          <Button onClick={() => navigate("/")} variant="outline">Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary font-mono">DIGIT DIFFERS</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set New Password</h1>
          <p className="text-muted-foreground">Enter your new password below</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4 bg-card p-6 rounded-lg border border-border">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="bg-muted border-border"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            <KeyRound className="w-4 h-4 mr-2" />
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
