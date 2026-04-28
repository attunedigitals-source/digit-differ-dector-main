// /pages/api/deriv/callback.ts
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code, state } = req.query;

  const verifier = global.oauthStore?.[state];

  if (!verifier) {
    return res.status(400).send("Invalid state");
  }

  const tokenRes = await axios.post(
    "https://api.deriv.com/oauth2/token",
    {
      grant_type: "authorization_code",
      code,
      app_id: process.env.DERIV_APP_ID,
      code_verifier: verifier,
    }
  );

  const { access_token, refresh_token, expires_in } = tokenRes.data;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase.from("deriv_accounts").insert({
    user_id: "TEMP_USER", // replace later with real auth
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000,
  });

  res.redirect("/dashboard");
}
