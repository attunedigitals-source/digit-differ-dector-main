import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { parseOAuthCallback, saveAccounts } from "@/lib/deriv";

export const Route = createFileRoute("/auth/callback")({
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const accounts = parseOAuthCallback(window.location.search);
      if (accounts.length === 0) {
        setError("No accounts returned from Deriv. Please try again.");
        return;
      }
      saveAccounts(accounts);
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      setError(e.message || "OAuth callback failed");
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-destructive">
              Sign-in failed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <a href="/" className="mt-4 inline-block text-primary underline">
              Back home
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Completing sign-in…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
