import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OAUTH_TOKEN_URL = "https://auth.deriv.com/oauth2/token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DerivTokenResponse {
  access_token?: string;
  token1?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const appId = Deno.env.get("DERIV_APP_ID");

    if (!appId) {
      throw new Error("DERIV_APP_ID secret not configured.");
    }

    const { code, codeVerifier, redirectUri } = await req.json();

    if (!code || !codeVerifier || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code, codeVerifier, redirectUri" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: appId,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = (await tokenResponse.json()) as DerivTokenResponse;

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({
          error: tokenData.error || "token_exchange_failed",
          error_description: tokenData.error_description || "Failed to exchange Deriv authorization code.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(tokenData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error during token exchange.";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
