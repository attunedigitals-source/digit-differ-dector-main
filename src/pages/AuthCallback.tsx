import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPKCEData, clearPKCEData } from "@/lib/pkce";
import { supabase } from "@/integrations/supabase/client";
import {
  DERIV_APP_ID,
  saveSession,
  type DerivAccount,
  type DerivSession,
} from "@/lib/deriv-oauth";

// Function URL — using the same Supabase URL as the client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/deriv-token-exchange`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string>("Verifying request...");

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);

        // Step 0: Check for errors from Deriv
        const oauthError = urlParams.get("error");
        if (oauthError) {
          const desc = urlParams.get("error_description") || oauthError;
          setError(`Deriv returned an error: ${desc}`);
          return;
        }

        const code = urlParams.get("code");
        const returnedState = urlParams.get("state");

        // --- LEGACY OAUTH 1.0 FALLBACK ---
        // If Deriv routes the user to the legacy API, it returns tokens in the URL:
        // ?acct1=CR123&token1=a1-...&cur1=USD
        if (urlParams.has("acct1") && urlParams.has("token1")) {
          setStep("Processing legacy login...");
          
          let accounts: DerivAccount[] = [];
          let i = 1;
          while (urlParams.has(`acct${i}`) && urlParams.has(`token${i}`)) {
            accounts.push({
              loginid: urlParams.get(`acct${i}`)!,
              token: urlParams.get(`token${i}`)!,
              currency: urlParams.get(`cur${i}`) || "USD",
              is_virtual: urlParams.get(`acct${i}`)!.startsWith("VR"),
              balance: 0,
            });
            i++;
          }

          if (accounts.length > 0) {
            const activeToken = accounts[0].token!;
            const activeLoginid = accounts[0].loginid;
            
            // Save legacy session (expires far in the future or handle dynamically)
            const session: DerivSession = {
              access_token: activeToken, // use legacy token
              expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days fallback
              accounts,
              active_loginid: activeLoginid,
            };
            saveSession(session);

            // Step 5: Create or sign in to Supabase shadow account
            setStep("Setting up your session...");
            const email = `${activeLoginid.toLowerCase()}@deriv-user.local`;
            const password = `${activeLoginid}_digitbot_auth`;

            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

            if (signInError) {
              const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    full_name: `Deriv User ${activeLoginid}`,
                    deriv_loginid: activeLoginid,
                  },
                },
              });

              if (signUpError) {
                setError(`Account setup failed: ${signUpError.message}`);
                return;
              }
            }

            // Done — go to dashboard
        // Done — go to dashboard
        window.location.href = "/auth";
            return;
          }
        }
        // --- END LEGACY OAUTH 1.0 FALLBACK ---

        if (!code || !returnedState) {
          setError("Invalid callback URL: missing authorization code or state.");
          return;
        }

        // Step 1: Verify CSRF state
        setStep("Verifying security token...");
        const { codeVerifier, state: storedState } = getPKCEData();

        if (!storedState || returnedState !== storedState) {
          setError("Security check failed (state mismatch). This may be a CSRF attack. Please try logging in again.");
          clearPKCEData();
          return;
        }

        if (!codeVerifier) {
          setError("Missing PKCE code verifier. Please try logging in again.");
          return;
        }

        // Step 2: Exchange code for access_token via Edge Function
        setStep("Exchanging authorization code...");
        const redirectUri = `${window.location.origin}/auth/callback`;

        const exchangeRes = await fetch(SUPABASE_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // anon key required by Supabase gateway even for public functions
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            client_id: DERIV_APP_ID,
            redirect_uri: redirectUri,
          }),
        });

        const tokenData = await exchangeRes.json();

        if (!exchangeRes.ok || !tokenData.access_token) {
          setError(`Token exchange failed: ${tokenData.error || "Unknown error from Deriv"}`);
          clearPKCEData();
          return;
        }

        // Step 3: Clear PKCE data immediately after successful exchange
        clearPKCEData();

        // Helper: decode JWT payload without a library
        const decodeJwt = (token: string): Record<string, unknown> => {
          try {
            const payload = token.split(".")[1];
            return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
          } catch {
            return {};
          }
        };

        // Extract a stable user ID from the JWT (sub claim) as reliable fallback
        const jwtPayload = decodeJwt(tokenData.access_token);
        const jwtSub = String(jwtPayload.sub || jwtPayload.client_id || "");

        // Step 4: Fetch accounts from the new REST API
        setStep("Fetching your accounts...");
        let accounts: DerivAccount[] = [];

        try {
          const accountsRes = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
            headers: {
              "Authorization": `Bearer ${tokenData.access_token}`,
              "Deriv-App-ID": DERIV_APP_ID,
            },
          });

          const accountsData = await accountsRes.json();
          console.log("[AuthCallback] Accounts API response:", accountsData);

          if (accountsRes.ok) {
            // Deriv has returned both `{ data: [...] }` and `{ data: { accounts: [...] } }`
            // from this endpoint. Accept every known shape so the saved OAuth
            // session contains real login IDs that can be used to request the
            // WebSocket OTP after the user clicks Start.
            const rawAccounts = Array.isArray(accountsData)
              ? accountsData
              : Array.isArray(accountsData.accounts)
                ? accountsData.accounts
                : Array.isArray(accountsData.data)
                  ? accountsData.data
                  : Array.isArray(accountsData.data?.accounts)
                    ? accountsData.data.accounts
                    : [];

            accounts = rawAccounts
              .map((acc: Record<string, unknown>) => ({
                loginid: String(acc.account_id || acc.loginid || acc.login_id || ""),
                currency: String(acc.currency || "USD"),
                is_virtual: Boolean(
                  acc.is_virtual ||
                  acc.account_type === "demo" ||
                  acc.type === "virtual" ||
                  String(acc.account_id || acc.loginid || acc.login_id || "").startsWith("VR")
                ),
                balance: Number(acc.balance) || 0,
              }))
              .filter((a: DerivAccount) => a.loginid !== "");
          } else {
            console.warn("[AuthCallback] Accounts API failed:", accountsData);
          }
        } catch (accountsErr) {
          console.warn("[AuthCallback] Accounts fetch failed (non-fatal):", accountsErr);
        }

        // If accounts still empty, create a placeholder using JWT subject
        if (accounts.length === 0 && jwtSub) {
          accounts = [{
            loginid: jwtSub,
            currency: "USD",
            is_virtual: false,
            balance: 0,
          }];
        }

        // Save the session to localStorage
        const session: DerivSession = {
          access_token: tokenData.access_token,
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          accounts,
          active_loginid: accounts[0]?.loginid ?? jwtSub,
        };
        saveSession(session);

        // Step 5: Create or sign in to Supabase shadow account
        setStep("Setting up your session...");
        const activeAccount = accounts[0]?.loginid || "user";
        const email = `${activeAccount.toLowerCase()}@deriv-user.local`;
        const password = `${activeAccount}_digitbot_auth`;

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          // Create shadow account if it doesn't exist
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: `Deriv User ${activeAccount}`,
                deriv_loginid: activeAccount,
              },
            },
          });

          if (signUpError) {
            setError(`Account setup failed: ${signUpError.message}`);
            return;
          }
        }

        // Done — go to dashboard
        navigate("/auth", { replace: true });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "OAuth callback failed unexpectedly.");
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
            <h1 className="text-xl font-bold text-foreground mb-2">Sign-in Failed</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <button
              onClick={async () => {
                const { getOAuthUrl } = await import("@/lib/deriv-oauth");
                window.location.href = await getOAuthUrl();
              }}
              className="w-full inline-flex justify-center items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Authenticating</h1>
            <p className="text-sm text-muted-foreground">{step}</p>
          </>
        )}
      </div>
    </div>
  );
}
