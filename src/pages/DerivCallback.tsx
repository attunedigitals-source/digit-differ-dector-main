import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { clearDerivOAuthSession, exchangeDerivAuthorizationCode, getCodeVerifier, validateOAuthState } from "@/lib/deriv-oauth";

interface DerivAuthorizeResponse {
  loginid?: string;
  email?: string;
}

const fetchDerivAuthorizeResponse = (token: string): Promise<DerivAuthorizeResponse> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://ws.derivws.com/websockets/v3");

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Timed out while fetching Deriv account details."));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.error) {
        clearTimeout(timer);
        ws.close();
        reject(new Error(payload.error.message || "Deriv authorization failed."));
        return;
      }

      if (payload.msg_type === "authorize" && payload.authorize) {
        clearTimeout(timer);
        const authorize = payload.authorize;
        ws.close();

        resolve({
          loginid: authorize.loginid,
          email: authorize.email,
        });
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Unable to connect to Deriv WebSocket."));
    };
  });
};

export default function DerivCallback() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const processToken = async (token: string) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        toast.error("Please sign in to the app before connecting Deriv.");
        navigate("/auth");
        return;
      }

      const derivAccount = await fetchDerivAuthorizeResponse(token).catch((error) => {
        console.warn("Could not load Deriv authorize details:", error);
        return null;
      });

      const derivLoginId = derivAccount?.loginid || null;
      const derivEmail = derivAccount?.email || currentUser.email || null;

      const { error: tokenError } = await supabase
        .from("user_deriv_tokens")
        .upsert(
          {
            user_id: currentUser.id,
            deriv_api_token: token,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (tokenError) {
        throw tokenError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          deriv_loginid: derivLoginId,
          deriv_email: derivEmail,
          email: currentUser.email || derivEmail,
        })
        .eq("id", currentUser.id);

      if (profileError) {
        throw profileError;
      }

      await refreshProfile();
      toast.success("Deriv account connected successfully.");
      navigate("/auth");
    };

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");

        if (!code) {
          throw new Error("Missing authorization code from Deriv OAuth callback.");
        }

        validateOAuthState(state);
        const verifier = getCodeVerifier();
        const token = await exchangeDerivAuthorizationCode(code, verifier);

        await processToken(token);
      } catch (error: unknown) {
        console.error("Deriv OAuth callback failed:", error);
        toast.error(error instanceof Error ? error.message : "Could not complete Deriv OAuth connection.");
        navigate("/auth");
      } finally {
        clearDerivOAuthSession();
      }
    };

    handleCallback();
  }, [navigate, refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <h2 className="text-xl font-semibold">Connecting your Deriv account...</h2>
        <p className="text-muted-foreground">Please wait while we secure your connection.</p>
      </div>
    </div>
  );
}
