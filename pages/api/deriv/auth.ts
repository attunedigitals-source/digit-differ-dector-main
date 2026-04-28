import type { NextApiRequest, NextApiResponse } from "next";
import { generateCodeChallenge, generateCodeVerifier, generateState } from "../../../lib/pkce";

const DERIV_OAUTH_AUTHORIZE_URL = process.env.DERIV_OAUTH_AUTHORIZE_URL ?? "https://oauth.deriv.com/oauth2/authorize";
const DERIV_CLIENT_ID = process.env.DERIV_CLIENT_ID;
const DERIV_REDIRECT_URI = process.env.DERIV_REDIRECT_URI;

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!DERIV_CLIENT_ID || !DERIV_REDIRECT_URI) {
    res.status(500).json({ error: "Missing Deriv OAuth environment variables" });
    return;
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  res.setHeader("Set-Cookie", [
    `deriv_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `deriv_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  ]);

  const authUrl = new URL(DERIV_OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("app_id", DERIV_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", DERIV_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  res.redirect(authUrl.toString());
}
