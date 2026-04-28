// /api/deriv/auth.js

export default function handler(req, res) {
  try {
    const appId = process.env.DERIV_APP_ID;
    const redirectUri = process.env.DERIV_REDIRECT_URI;

    if (!appId || !redirectUri) {
      return res.status(500).json({
        error: "Missing environment variables"
      });
    }

    const state = Math.random().toString(36).substring(2);

    const url = `https://oauth.deriv.com/oauth2/authorize
?app_id=${appId}
&redirect_uri=${encodeURIComponent(redirectUri)}
&response_type=code
&scope=trade account_manage
&state=${state}`;

    res.writeHead(302, { Location: url });
    res.end();

  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
