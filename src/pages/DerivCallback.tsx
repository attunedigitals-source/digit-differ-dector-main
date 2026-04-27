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
      // Deriv sends tokens in the URL parameters
      const params = new URLSearchParams(window.location.search);
      
      // If Deriv uses hash instead of query, check that too
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      
      const acct1 = params.get("acct1") || hashParams.get("acct1");
      const token1 = params.get("token1") || hashParams.get("token1");
      
      if (!acct1 || !token1) {
        console.error("Missing account or token in callback", { 
          query: window.location.search, 
          hash: window.location.hash 
        });
        toast.error("Failed to connect Deriv account: Missing authorization data.");
        navigate("/dashboard");
        return;
      }

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
              deriv_api_token: token1,
              updated_at: new Date().toISOString()
            },
            { onConflict: "user_id" }
          );

        if (tokenError) throw tokenError;

        // 2. Update profile with Deriv details
        // We'll also try to get the email from the account list if possible, 
        // but acct1 is the loginid.
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            deriv_loginid: acct1,
            // We might not have the email yet, we can fetch it via API later if needed
          })
          .eq("id", currentUser.id);

        if (profileError) throw profileError;

        await refreshProfile();
        toast.success("Deriv account connected successfully!");
        navigate("/dashboard");
      } catch (error: any) {
        console.error("Error in Deriv callback:", error);
        toast.error(`Error connecting Deriv: ${error.message}`);
        navigate("/dashboard");
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
