import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function DerivCallback() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      
      const storedState = sessionStorage.getItem("deriv_oauth_state");
      const verifier = sessionStorage.getItem("deriv_code_verifier");
      
      if (!code) {
        // Fallback for implicit flow if still active or if error
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const token1 = params.get("token1") || hashParams.get("token1");
        const acct1 = params.get("acct1") || hashParams.get("acct1");
        
        if (token1 && acct1) {
          await processToken(token1, acct1);
          return;
        }

        console.error("Missing code in callback", { query: window.location.search });
        toast.error("Failed to connect: Missing authorization code.");
        navigate("/dashboard");
        return;
      }

      if (state !== storedState) {
        console.error("State mismatch", { received: state, stored: storedState });
        toast.error("Security alert: OAuth state mismatch.");
        navigate("/dashboard");
        return;
      }

      if (!verifier) {
        console.error("Missing code verifier");
        toast.error("Failed to connect: Missing security verifier.");
        navigate("/dashboard");
        return;
      }

      try {
        const appId = import.meta.env.VITE_DERIV_APP_ID;
        const redirectUri = `${window.location.origin}/deriv-callback`;

        const response = await fetch("https://oauth.deriv.com/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: appId,
            redirect_uri: redirectUri,
            code: code,
            code_verifier: verifier,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error_description || errorData.error || "Failed to exchange code");
        }

        const data = await response.json();
        // Deriv's response for code exchange typically includes the token and account info
        // Note: You might need to adjust based on the exact structure Deriv returns
        const token = data.access_token || data.token1;
        const account = data.account_id || data.acct1;

        if (!token || !account) {
          throw new Error("Token or account ID not found in response");
        }

        await processToken(token, account);
      } catch (error: any) {
        console.error("Error in Deriv code exchange:", error);
        toast.error(`Error connecting Deriv: ${error.message}`);
        navigate("/dashboard");
      } finally {
        // Clean up session storage
        sessionStorage.removeItem("deriv_code_verifier");
        sessionStorage.removeItem("deriv_oauth_state");
      }
    };

    const processToken = async (token: string, loginid: string) => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          toast.error("Please log in to the app first.");
          navigate("/auth");
          return;
        }

        // 1. Save the primary token
        const { error: tokenError } = await supabase
          .from("user_deriv_tokens")
          .upsert(
            { 
              user_id: currentUser.id, 
              deriv_api_token: token,
              updated_at: new Date().toISOString()
            },
            { onConflict: "user_id" }
          );

        if (tokenError) throw tokenError;

        // 2. Update profile with Deriv details
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            deriv_loginid: loginid,
          })
          .eq("id", currentUser.id);

        if (profileError) throw profileError;

        await refreshProfile();
        toast.success("Deriv account connected successfully!");
        navigate("/dashboard");
      } catch (error: any) {
        console.error("Error processing token:", error);
        throw error;
      }
    };

    handleCallback();
  }, [navigate, user, refreshProfile]);


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
