import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseOAuthCallback, saveAccounts } from "@/lib/deriv-oauth";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const search = window.location.search;
      // If there's no search string, maybe they came here by mistake
      if (!search || search.length <= 1) {
        setError("Invalid callback URL: missing parameters.");
        return;
      }

      const accounts = parseOAuthCallback(search);
      
      if (accounts.length === 0) {
        setError("No accounts returned from Deriv. Please try again.");
        return;
      }
      
      const activeAccount = accounts[0].loginid;
      const email = `${activeAccount.toLowerCase()}@deriv-user.local`;
      const password = `${activeAccount}_digitbot_auth`; // deterministic, pseudo-secure password for shadow account
      
      // Step 1: Try to sign in to Supabase using shadow account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        // Step 2: If sign in fails (likely user doesn't exist), create the shadow account
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: `Deriv User ${activeAccount}`,
              deriv_loginid: activeAccount
            }
          }
        });

        if (signUpError) {
          setError(`Supabase Shadow Account creation failed: ${signUpError.message}`);
          return;
        }
      }

      // Step 3: Supabase session is established, now save Deriv accounts locally
      saveAccounts(accounts);
      
      // Redirect to the dashboard
      navigate("/auth", { replace: true });
    } catch (e: any) {
      setError(e.message || "OAuth callback failed");
    }
  };
  
  handleAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center p-8 bg-card border border-border rounded-xl shadow-lg max-w-md w-full">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Sign-in Failed
            </h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <button 
              onClick={() => navigate("/auth")}
              className="w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Return to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">
              Authenticating
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we securely connect your Deriv account...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
