// Deriv WebSocket API + OAuth helpers.
// OAuth: redirect users to Deriv's OAuth page; they return with ?token1=&acct1=&cur1=
// Trading uses authenticated WS connection with that token.

export const DERIV_APP_ID =
  (import.meta.env.VITE_DERIV_APP_ID as string) || "117322";
export const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

export type DerivAccount = {
  token: string;
  loginid: string;
  currency: string;
};

const STORAGE_KEY = "deriv.accounts";
const ACTIVE_KEY = "deriv.activeLoginid";

export function getOAuthUrl(): string {
  const redirect = window.location.origin + "/auth/callback";
  return `https://oauth.deriv.com/oauth2/authorize?app_id=${DERIV_APP_ID}&l=EN&redirect_uri=${encodeURIComponent(redirect)}`;
}

export function parseOAuthCallback(search: string): DerivAccount[] {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const accounts: DerivAccount[] = [];
  let i = 1;
  while (params.get(`token${i}`)) {
    accounts.push({
      token: params.get(`token${i}`)!,
      loginid: params.get(`acct${i}`) || `acc${i}`,
      currency: params.get(`cur${i}`) || "USD",
    });
    i++;
  }
  return accounts;
}

export function saveAccounts(accounts: DerivAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  if (accounts[0]) localStorage.setItem(ACTIVE_KEY, accounts[0].loginid);
}

export function getAccounts(): DerivAccount[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getActiveAccount(): DerivAccount | null {
  const accs = getAccounts();
  const active = localStorage.getItem(ACTIVE_KEY);
  return accs.find((a) => a.loginid === active) || accs[0] || null;
}

export function setActiveAccount(loginid: string) {
  localStorage.setItem(ACTIVE_KEY, loginid);
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}

// ---- WebSocket client with request/response correlation ----

type Pending = { resolve: (v: any) => void; reject: (e: any) => void };

export class DerivWS {
  private ws: WebSocket | null = null;
  private reqId = 1;
  private pending = new Map<number, Pending>();
  private subs = new Map<string, (msg: any) => void>(); // subscription id -> handler
  private streamHandlers = new Map<string, (msg: any) => void>(); // msg_type -> handler
  private openPromise: Promise<void> | null = null;

  connect(): Promise<void> {
    if (this.openPromise) return this.openPromise;
    this.openPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(DERIV_WS_URL);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => this.handle(JSON.parse(ev.data));
      this.ws.onclose = () => {
        this.pending.forEach((p) => p.reject(new Error("WS closed")));
        this.pending.clear();
        this.openPromise = null;
      };
    });
    return this.openPromise;
  }

  private handle(msg: any) {
    const id = msg.req_id;
    if (id && this.pending.has(id)) {
      const p = this.pending.get(id)!;
      this.pending.delete(id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg);
    }
    // Stream handler keyed by msg_type
    const sh = this.streamHandlers.get(msg.msg_type);
    if (sh) sh(msg);
  }

  send<T = any>(payload: Record<string, any>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket not open"));
    }
    const req_id = this.reqId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(req_id, { resolve, reject });
      this.ws!.send(JSON.stringify({ ...payload, req_id }));
    });
  }

  onStream(msgType: string, handler: (msg: any) => void) {
    this.streamHandlers.set(msgType, handler);
  }

  offStream(msgType: string) {
    this.streamHandlers.delete(msgType);
  }

  async authorize(token: string) {
    return this.send({ authorize: token });
  }

  close() {
    this.ws?.close();
    this.ws = null;
    this.openPromise = null;
  }
}
