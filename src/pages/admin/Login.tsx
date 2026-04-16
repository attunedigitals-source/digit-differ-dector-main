import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Lock, Mail, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInit, setShowInit] = useState(false);
  const { signIn, initializeAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        // Special case for first-time admin login if password fails or user not found
        if (email === "amusco2@yahoo.com") {
          setShowInit(true);
          if (error.message.includes("Invalid login credentials")) {
            toast.info("Initial login? You may need to initialize your admin account.");
          }
        }
        throw error;
      }

      if (data.user) {
        toast.success("Login successful");
        navigate("/admin/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const { error } = await initializeAdmin(email);
      if (error) throw error;
      toast.success("Admin account initialized! Check your email for a confirmation link if required, then log in with your email as the password.");
      setShowInit(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your admin email first");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent to your email");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Admin Gateway</CardTitle>
          <CardDescription>Enter your credentials to access the command center</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            {email === "amusco2@yahoo.com" && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex gap-3 text-xs text-primary/80">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>Default Admin: Use your email as the initial password if this is your first login.</p>
              </div>
            )}

            {showInit && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full border-primary/50 text-primary hover:bg-primary/5"
                onClick={handleInitialize}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Initialize Admin Account (First Time)
              </Button>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Access Dashboard
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
