// /pages/api/deriv/auth.ts
import { generateVerifier, generateChallenge } from "@/lib/pkce";

export default async function handler(req, res) {
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);
  const state = crypto.randomUUID();

  // TEMP STORE (IMPORTANT)
  global.oauthStore = global.oauthStore || {};
  global.oauthStore[state] = verifier;

  const url = `https://oauth.deriv.com/oauth2/authorize
?app_id=${process.env.DERIV_APP_ID}
&redirect_uri=${encodeURIComponent(process.env.DERIV_REDIRECT_URI)}
&response_type=code
&scope=trade account_manage
&state=${state}
&code_challenge=${challenge}
&code_challenge_method=S256`;

  res.redirect(url);
}
