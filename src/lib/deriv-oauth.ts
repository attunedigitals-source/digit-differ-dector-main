// Deriv OAuth helpers

export const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID || "117322";

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
  if (accounts[0]) {
    localStorage.setItem(ACTIVE_KEY, accounts[0].loginid);
  }
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

export function clearDerivAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ACTIVE_KEY);
}
