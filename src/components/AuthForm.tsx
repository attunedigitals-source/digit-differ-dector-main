import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { LogIn, UserPlus, Zap, ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "true");
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    setLoading(true);
    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (isSignUp) {
      toast.success("Account created successfully!");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset link sent! Check your email.");
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <span className="text-xs md:text-sm font-semibold text-primary font-mono select-none">DIGIT DIFFERS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Trading Signal System</h1>
          <p className="text-sm md:text-base text-muted-foreground">Real-time synthetic index analysis</p>
        </div>

        {isForgot ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 bg-card p-6 rounded-lg border border-border">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-muted border-border"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
            <button
              type="button"
              onClick={() => setIsForgot(false)}
              className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Sign In
            </button>
          </form>
        ) : (
          <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full bg-background border-border hover:bg-muted font-normal h-11"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="bg-muted border-border"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-muted border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-sm font-medium text-foreground">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="bg-muted border-border pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {confirmPassword && (
                        password === confirmPassword ? 
                        <Check className="w-4 h-4 text-green-500 animate-in zoom-in duration-200" /> : 
                        <X className="w-4 h-4 text-red-500 animate-in shake duration-200" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot your password?
                </button>
              )}
              
              <Button type="submit" className="w-full" disabled={loading}>
                {isSignUp ? <UserPlus className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
              </Button>
              
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setConfirmPassword("");
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
