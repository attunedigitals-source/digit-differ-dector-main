export default function handler(req, res) {
  try {
    const appId = process.env.DERIV_APP_ID;
    const redirectUri = process.env.DERIV_REDIRECT_URI;

    if (!appId || !redirectUri) {
      throw new Error("Missing ENV variables");
    }

    const state = Math.random().toString(36).substring(2);

    const url =
      `https://oauth.deriv.com/oauth2/authorize` +
      `?app_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    console.log("REDIRECTING TO:", url);

    res.writeHead(302, { Location: url });
    res.end();

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message || "Internal error"
    });
  }
}
