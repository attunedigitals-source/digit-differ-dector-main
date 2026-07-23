import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, MessageSquare, ShieldCheck, ArrowRight, LogOut, Sparkles, CheckCircle2, User } from "lucide-react";
import { getOAuthUrl, getSession } from "@/lib/deriv-oauth";
import { getCurrentClientUser, WHATSAPP_GROUP_URL } from "@/lib/leads";
import { toast } from "sonner";

export const ClientPortal: React.FC = () => {
  const navigate = useNavigate();
  const [clientUser, setClientUser] = useState<{ email: string; name: string; phone?: string } | null>(null);
  const [activeDerivId, setActiveDerivId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // 1. Get current logged-in client user details
    const user = getCurrentClientUser();
    if (user) {
      setClientUser(user);
    } else {
      // Fallback default if navigating directly
      setClientUser({
        name: "Valued Client",
        email: "",
      });
    }

    // 2. Check for active Deriv session
    const session = getSession();
    if (session && session.active_loginid) {
      setActiveDerivId(session.active_loginid);
    }
  }, []);

  const handleConnectDeriv = async () => {
    setIsConnecting(true);
    try {
      const oauthUrl = await getOAuthUrl();
      window.location.href = oauthUrl;
    } catch (e) {
      console.error(e);
      toast.error("Could not initiate Deriv connection. Please try again.");
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("current_client_user");
    toast.success("Logged out successfully");
    navigate("/auth");
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

          <div className="flex items-center gap-3">
            {clientUser?.email && (
              <div className="hidden sm:flex items-center gap-2 bg-card/60 border border-border/60 px-3 py-1.5 rounded-full text-xs font-medium">
                <User className="w-3.5 h-3.5 text-primary" />
                <span className="text-foreground">{clientUser.email}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs border-border/60 hover:bg-destructive/10 hover:text-destructive gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center justify-center text-center space-y-10">
        {/* Welcome Greeting Banner */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Client Portal Access
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            You are Welcome, <span className="text-primary">{clientUser?.name || "Client"}</span>!
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Your Digit Bot Pro Client Portal is active. Connect your Deriv account below to launch real-time ensemble analytics and start automated trading.
          </p>

          {activeDerivId && (
            <div className="pt-2">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs px-3 py-1 font-mono gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Active Deriv Connection: {activeDerivId}
              </Badge>
            </div>
          )}
        </div>

        {/* Action Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 w-full max-w-4xl">
          {/* Card 1: Connect to Deriv */}
          <Card className="border border-primary/30 bg-card/80 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between text-left group hover:border-primary transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all pointer-events-none" />
            <CardHeader className="space-y-2 pb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center border border-primary/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">Connect to Deriv</CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Connect your active Deriv trading account securely via OAuth 2.0 PKCE to launch the automated Digit Bot Pro.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2 text-xs text-foreground/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Real-time Tick Analytics & Digit Differ Algorithms</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span>Automated Risk & Consecutive Loss Protection</span>
                </div>
              </div>

              <Button
                onClick={handleConnectDeriv}
                disabled={isConnecting}
                className="w-full h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 mt-4"
              >
                {isConnecting ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    Connect to Deriv <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: WhatsApp Community */}
          <Card className="border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl flex flex-col justify-between text-left group hover:border-emerald-500/50 transition-all">
            <CardHeader className="space-y-2 pb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <MessageSquare className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">VIP WhatsApp Group</CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Join our active WhatsApp community for live trade updates, strategy setups, and direct support from the admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2 text-xs text-foreground/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Free Trade Updates & Market Signals</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Admin & Community Bot Support</span>
                </div>
              </div>

              <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full mt-4"
              >
                <Button
                  variant="outline"
                  className="w-full h-12 text-sm font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Join VIP WhatsApp Group
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Digit Bot Pro. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ClientPortal;
