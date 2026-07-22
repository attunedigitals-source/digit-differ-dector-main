import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  email: string;
  phone: string;
  source: "tiktok_paid" | "organic_direct";
  whatsappOptIn?: boolean;
  name?: string;
}

export const TIKTOK_PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || "D9GASABC77UBS5FSL7C0";
export const WHATSAPP_GROUP_URL = import.meta.env.VITE_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/B5QnMkxnHMeEXnW7HUfIPS";

/**
 * Hashes a string using client-side SHA-256 for TikTok PII Advanced Matching
 */
export async function sha256Hash(message: string): Promise<string> {
  try {
    if (!message) return "";
    const cleanStr = message.trim().toLowerCase();
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(cleanStr);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return "";
  } catch (e) {
    return "";
  }
}

/**
 * Identifies user for TikTok Advanced Matching before event postback
 */
export async function identifyTikTokUser(email?: string, phone?: string) {
  try {
    const windowObj = window as any;
    if (windowObj.ttq && typeof windowObj.ttq.identify === "function") {
      const pii: Record<string, string> = {};
      if (email) {
        const hashedEmail = await sha256Hash(email);
        if (hashedEmail) pii.email = hashedEmail;
      }
      if (phone) {
        const hashedPhone = await sha256Hash(phone);
        if (hashedPhone) pii.phone_number = hashedPhone;
      }
      if (Object.keys(pii).length > 0) {
        windowObj.ttq.identify(pii);
        console.log("[TikTok Pixel] User identified with hashed PII for Advanced Matching");
      }
    }
  } catch (e) {
    console.warn("[TikTok Pixel] User identification notice:", e);
  }
}

/**
 * Saves lead details to Supabase table `leads` if available, and back-up to localStorage.
 */
export async function submitLead(data: LeadData): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Backup to localStorage array
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    const existingLeads = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    const leadRecord = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    existingLeads.push(leadRecord);
    localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
    sessionStorage.setItem("digit_bot_latest_lead", JSON.stringify({ email: data.email, phone: data.phone }));

    // 2. Perform TikTok Advanced Matching Identification
    await identifyTikTokUser(data.email, data.phone);

    // 3. Insert into Supabase table 'leads' if it exists
    const { error } = await supabase.from("leads" as any).insert({
      email: data.email,
      phone: data.phone,
      name: data.name || null,
      source: data.source,
      whatsapp_opt_in: data.whatsappOptIn ?? true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("[Leads] Supabase table insert notice (saved locally):", error.message);
    } else {
      console.log("[Leads] Lead saved to Supabase successfully:", data.email);
    }

    return { success: true, message: "Lead submitted successfully." };
  } catch (err: any) {
    console.error("[Leads] Error submitting lead:", err);
    return { success: true, message: "Lead captured." };
  }
}

/**
 * Initializes and triggers TikTok Pixel event tracking with Advanced Matching support.
 */
export async function fireTikTokPixelEvent(eventName: string = "CompleteRegistration", customData: Record<string, any> = {}) {
  try {
    const windowObj = window as any;
    if (typeof windowObj.ttq === "undefined") {
      // Inject TikTok Pixel Script dynamically if not present
      (function (w: any, d: any, t: string) {
        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = [
          "page", "track", "identify", "instances", "debug", "on", "off",
          "once", "ready", "alias", "group", "enableCookie", "disableCookie",
          "holdConsent", "revokeConsent", "grantConsent"
        ];
        ttq.setAndDefer = function (t: any, e: any) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (let i = 0; i < ttq.methods.length; i++) {
          ttq.setAndDefer(ttq, ttq.methods[i]);
        }
        ttq.instance = function (t: any) {
          const e = ttq._i[t] || [];
          for (let n = 0; n < ttq.methods.length; n++) {
            ttq.setAndDefer(e, ttq.methods[n]);
          }
          return e;
        };
        ttq.load = function (e: any, n: any) {
          const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = i;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          const c = d.createElement("script");
          c.type = "text/javascript";
          c.async = true;
          c.src = i + "?sdkid=" + e + "&lib=" + t;
          const s = d.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(c, s);
        };

        if (TIKTOK_PIXEL_ID) {
          ttq.load(TIKTOK_PIXEL_ID);
          ttq.page();
        }
      })(window, document, "ttq");
    }

    // Try identifying user from latest lead session data
    const savedLead = sessionStorage.getItem("digit_bot_latest_lead");
    if (savedLead) {
      try {
        const { email, phone } = JSON.parse(savedLead);
        await identifyTikTokUser(email, phone);
      } catch (e) {
        // ignore JSON parse error
      }
    }

    if (windowObj.ttq && typeof windowObj.ttq.track === "function") {
      const defaultPayload = {
        contents: [
          {
            content_id: "digit_bot_pro",
            content_type: "product",
            content_name: "Digit Bot Pro VIP Access",
          },
        ],
        value: 0,
        currency: "USD",
        ...customData,
      };

      windowObj.ttq.track(eventName, defaultPayload);
      console.log(`[TikTok Pixel] Event '${eventName}' tracked with Pixel ID '${TIKTOK_PIXEL_ID}'`, defaultPayload);
    }
  } catch (e) {
    console.warn("[TikTok Pixel] Could not fire pixel event:", e);
  }
}

export interface LeadRecord extends LeadData {
  timestamp: string;
  deriv_loginid?: string;
  deriv_accounts?: any[];
}

/**
 * Links an authenticated Deriv account ID to the user's lead email & phone.
 */
export async function linkLeadToDerivAccount(derivLoginId: string, derivAccounts?: any[]) {
  try {
    if (!derivLoginId) return;

    let leadEmail = "";
    const sessionLeadRaw = sessionStorage.getItem("digit_bot_latest_lead");
    if (sessionLeadRaw) {
      try {
        const parsed = JSON.parse(sessionLeadRaw);
        leadEmail = parsed.email || "";
      } catch (e) {}
    }

    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    const existingLeads: LeadRecord[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];

    if (!leadEmail && existingLeads.length > 0) {
      const lastLead = existingLeads[existingLeads.length - 1];
      leadEmail = lastLead.email;
    }

    // 1. Update localStorage leads
    if (existingLeads.length > 0) {
      const updatedLeads = existingLeads.map((record) => {
        if (!leadEmail || record.email?.toLowerCase() === leadEmail.toLowerCase()) {
          return {
            ...record,
            deriv_loginid: derivLoginId,
            deriv_accounts: derivAccounts || record.deriv_accounts,
          };
        }
        return record;
      });
      localStorage.setItem("digit_bot_captured_leads", JSON.stringify(updatedLeads));
    }

    // 2. Update Supabase leads table
    if (leadEmail) {
      const { error } = await supabase
        .from("leads" as any)
        .update({
          deriv_loginid: derivLoginId,
          deriv_accounts: derivAccounts ? JSON.stringify(derivAccounts) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("email", leadEmail);

      if (error) {
        console.warn("[Leads] Supabase lead update notice:", error.message);
      } else {
        console.log(`[Leads] Matched Lead email '${leadEmail}' to Deriv Account ID '${derivLoginId}'`);
      }
    }
  } catch (err) {
    console.error("[Leads] Error linking lead to Deriv account:", err);
  }
}

/**
 * Retrieves all captured leads with matched Deriv Account IDs.
 */
export async function getAllLeads(): Promise<LeadRecord[]> {
  try {
    const { data, error } = await supabase.from("leads" as any).select("*").order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        email: d.email,
        phone: d.phone,
        name: d.name,
        source: d.source || "organic_direct",
        whatsappOptIn: d.whatsapp_opt_in,
        timestamp: d.created_at,
        deriv_loginid: d.deriv_loginid,
        deriv_accounts: typeof d.deriv_accounts === "string" ? JSON.parse(d.deriv_accounts) : d.deriv_accounts,
      }));
    }
  } catch (e) {
    console.warn("[Leads] Supabase fetch fallback to local:", e);
  }

  const localRaw = localStorage.getItem("digit_bot_captured_leads");
  return localRaw ? JSON.parse(localRaw) : [];
}
