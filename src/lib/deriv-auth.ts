const DERIV_WS_BASE = "wss://ws.derivws.com/websockets/v3";
const DERIV_REST_BASE = "https://api.derivws.com";

export type DerivAuthMethod = "legacy_authorize" | "pat_otp";

export function isPatToken(token: string): boolean {
  return token.trim().startsWith("pat_");
}

export function maskToken(token: string): string {
  const clean = token || "";
  if (clean.length <= 8) return "****";
  return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAuthLikeError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("invalidtoken") ||
    message.includes("invalid token") ||
    message.includes("authorization") ||
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("invalidappid") ||
    message.includes("invalid app") ||
    message.includes("websocket closed before authentication") ||
    message.includes("websocket connection timeout") ||
    message.includes("websocket connection error") ||
    message.includes("failed to fetch") ||
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("cors")
  );
}

function waitForOpen(ws: WebSocket, timeoutMs = 10000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {}
      reject(new Error("WebSocket connection timeout"));
    }, timeoutMs);

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ws);
    };

    ws.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("WebSocket closed before authentication"));
    };
  });
}

function sendAndWait<T = any>(
  ws: WebSocket,
  payload: Record<string, any>,
  expectedMsgType: string,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      ws.removeEventListener("message", onMessage);
      reject(new Error(`Timeout waiting for ${expectedMsgType}`));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);

        if (data.error) {
          clearTimeout(timer);
          ws.removeEventListener("message", onMessage);
          reject(new Error(`${data.error.code}: ${data.error.message}`));
          return;
        }

        if (data.msg_type === expectedMsgType) {
          clearTimeout(timer);
          ws.removeEventListener("message", onMessage);
          resolve(data as T);
        }
      } catch (error) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMessage);
        reject(error);
      }
    }

    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify(payload));
  });
}

export async function connectWithLegacyAuthorize({
  appId,
  token,
}: {
  appId: string;
  token: string;
}) {
  const ws = new WebSocket(`${DERIV_WS_BASE}?app_id=${encodeURIComponent(appId)}`);

  try {
    await waitForOpen(ws);

    const authResponse = await sendAndWait(ws, { authorize: token }, "authorize");

    return {
      ws,
      method: "legacy_authorize" as const,
      authorizeData: authResponse,
    };
  } catch (error) {
    try {
      ws.close();
    } catch {}
    throw error;
  }
}

export async function connectWithPatOtp({
  appId,
  token,
  accountId,
}: {
  appId: string;
  token: string;
  accountId?: string;
}) {
  if (!accountId?.trim()) {
    throw new Error(
      "PAT token detected. Please provide the Deriv account ID, for example CR1234567 or VRTC1234567."
    );
  }

  const response = await fetch(
    `${DERIV_REST_BASE}/trading/v1/options/accounts/${encodeURIComponent(accountId.trim())}/otp`,
    {
      method: "POST",
      headers: {
        "Deriv-App-ID": appId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PAT OTP failed: HTTP ${response.status} ${body}`);
  }

  const json = await response.json();

  const wsUrl =
    json?.url ||
    json?.data?.url ||
    json?.websocket_url ||
    json?.data?.websocket_url;

  if (!wsUrl) {
    throw new Error("PAT OTP response did not include an authenticated WebSocket URL.");
  }

  const ws = new WebSocket(wsUrl);

  try {
    await waitForOpen(ws);

    return {
      ws,
      method: "pat_otp" as const,
      authorizeData: null,
      accountId: accountId.trim(),
    };
  } catch (error) {
    try {
      ws.close();
    } catch {}
    throw error;
  }
}

export async function connectDerivClient({
  appId,
  token,
  accountId,
  preferredAuthMethod,
}: {
  appId: string;
  token: string;
  accountId?: string;
  preferredAuthMethod?: DerivAuthMethod;
}) {
  const cleanToken = token.trim();

  if (!appId?.trim()) {
    throw new Error("Deriv App ID is required.");
  }

  if (!cleanToken) {
    throw new Error("Deriv API token is required.");
  }

  const detectedOrder: DerivAuthMethod[] = isPatToken(cleanToken)
    ? ["pat_otp", "legacy_authorize"]
    : ["legacy_authorize", "pat_otp"];

  const methods: DerivAuthMethod[] = preferredAuthMethod
    ? [preferredAuthMethod, ...detectedOrder.filter((m) => m !== preferredAuthMethod)]
    : detectedOrder;

  let lastError: unknown;

  for (const method of methods) {
    try {
      if (method === "legacy_authorize") {
        return await connectWithLegacyAuthorize({
          appId,
          token: cleanToken,
        });
      }

      if (method === "pat_otp") {
        return await connectWithPatOtp({
          appId,
          token: cleanToken,
          accountId,
        });
      }
    } catch (error) {
      lastError = error;

      if (!isAuthLikeError(error)) {
        throw error;
      }

      console.warn(
        `Deriv auth method ${method} failed. Trying fallback if available. Error: ${getErrorMessage(error)}`
      );
    }
  }

  throw new Error(
    `Deriv authentication failed. Please confirm the token, app ID, account ID, and token permissions. Last error: ${getErrorMessage(lastError)}`
  );
}
