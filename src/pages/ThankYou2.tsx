import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, MessageSquare, LogIn, ArrowRight, Zap, ExternalLink } from "lucide-react";
import { fireTikTokPixelEvent, WHATSAPP_GROUP_URL } from "@/lib/leads";

export const ThankYou2: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Retrieve latest captured lead details for PII Advanced Matching (hashed client side)
    let leadEmail: string | undefined;
    let leadPhone: string | undefined;

    try {
      const stored = localStorage.getItem("digit_bot_captured_leads");
      if (stored) {
        const leads = JSON.parse(stored);
        if (Array.isArray(leads) && leads.length > 0) {
          const latest = leads[leads.length - 1];
          leadEmail = latest.email;
          leadPhone = latest.phone;
        }
      }
    } catch (e) {
      console.warn("[ThankYou2] Could not read stored lead for pixel identification:", e);
    }

    // 2. Fire TikTok Pixel Event specifically for Paid Ad conversion tracking with SHA-256 PII
    fireTikTokPixelEvent(
      "CompleteRegistration",
      {
        source: "tiktok_paid_landing_2",
        content_name: "TikTok VIP Lead Registration",
        value: 0,
        currency: "USD",
      },
      {
        email: leadEmail,
        phone: leadPhone,
      }
    );
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/30">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Zap className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Digit Bot <span className="text-primary">Pro</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl mx-auto px-6 py-16 flex items-center justify-center w-full">
        <Card className="w-full border border-primary/30 bg-card/90 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center p-6 sm:p-8">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Registration Complete!
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Thank you for joining. Your VIP TikTok lead status has been recorded. You can now join our active WhatsApp community and log in to launch Digit Bot Pro.
          </p>

          <div className="space-y-4">
            {/* Step 1: Join WhatsApp */}
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full h-13 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                <MessageSquare className="w-5 h-5" /> Join VIP WhatsApp Group <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
              </Button>
            </a>

            {/* Step 2: Login Page */}
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="w-full h-13 text-sm font-bold border-primary/40 text-primary hover:bg-primary/10 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" /> Proceed to Login & Launch App <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-border/40 text-xs text-muted-foreground">
            Having trouble? Return to <Link to="/" className="text-primary underline">Home Page</Link>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Digit Bot Pro. TikTok Lead Generation Tracking Enabled.
      </footer>
    </div>
  );
};

export default ThankYou2;
