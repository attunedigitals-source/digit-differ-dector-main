import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, UserPlus, CheckCircle2, ArrowRight, Shield } from "lucide-react";
import { submitLead } from "@/lib/leads";
import { toast } from "sonner";

export const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !phone || !password) {
      toast.error("Please fill in email, WhatsApp phone, and create a password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLead({
        email,
        phone,
        name,
        password,
        source: "organic_direct",
        whatsappOptIn: true,
      });

      toast.success("Registration completed! Redirecting to confirmation page...");
      navigate("/thank-you-1");
    } catch (error) {
      console.error(error);
      toast.error("Registration failed. Please try again.");
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
              Already have an account? Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex-1 space-y-5 text-left">
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
            Create Your Account & Join Our <span className="text-primary">WhatsApp Community</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Register to get access to automated Deriv trading tool with its real-time ensemble analytics, and our active WhatsApp community.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Instant Access to Digit Bot Pro Trading Tool Algorithms</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Seamless Deriv Account Integration</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground/90">Free WhatsApp Group Support & Trade Updates</span>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[400px]">
          <Card className="border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-1 text-left pb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 border border-primary/20">
                <UserPlus className="w-5 h-5" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Register Account</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your details to create your account and access WhatsApp updates.
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
                  <span className="text-[10px] text-muted-foreground">Include country code</span>
                </div>

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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 mt-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Register & Continue <ArrowRight className="w-4 h-4" />
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

export default RegistrationPage;
