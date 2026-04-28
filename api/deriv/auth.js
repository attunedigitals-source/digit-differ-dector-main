// /api/deriv/auth.js

export default function handler(req, res) {
  try {
    console.log("ENV CHECK:", {
      appId: process.env.DERIV_APP_ID,
      redirect: process.env.DERIV_REDIRECT_URI
    });

    const appId = process.env.DERIV_APP_ID;
    const redirectUri = process.env.DERIV_REDIRECT_URI;

    if (!appId || !redirectUri) {
      throw new Error("Missing ENV variables");
    }

    const state = Math.random().toString(36).substring(2);

    const url = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=trade%20account_manage&state=${state}`;

    console.log("REDIRECTING TO:", url);

    res.writeHead(302, { Location: url });
    res.end();

  } catch (err) {
    console.error("FULL ERROR:", err); // 👈 THIS IS KEY

    res.status(500).json({
      error: err.message || "Internal error"
    });
  }
}
