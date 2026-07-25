import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, LogIn, Lock, Mail, ArrowRight } from "lucide-react";
import { loginClientUser } from "@/lib/leads";
import { toast } from "sonner";

export function AuthForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your registered email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginClientUser(email, password);
      if (result.success) {
        toast.success(`Welcome back, ${result.name || "Client"}!`);
        navigate("/client-portal");
      } else {
        toast.error(result.message || "Invalid credentials.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Login failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <span className="text-xs md:text-sm font-semibold text-primary font-mono select-none">DIGIT DIFFERS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Digit Bot Pro Client Portal</h1>
          <p className="text-sm md:text-base text-muted-foreground">Sign in to access your portal & connect to Deriv</p>
        </div>

        <div className="space-y-6 bg-card p-6 md:p-8 rounded-xl border border-border shadow-xl">
          {/* Client Email & Password Login Form */}
          <form onSubmit={handleClientLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" /> Password
              </label>
              <Input
                type="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                  <LogIn className="w-4 h-4" /> Client Portal Login
                </>
              )}
            </Button>
          </form>



          {/* Registration Prompt */}
          <div className="pt-2 text-center border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              Don't have an account yet?{" "}
              <Link to="/register" className="text-primary font-semibold hover:underline">
                Register Here <ArrowRight className="inline w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
