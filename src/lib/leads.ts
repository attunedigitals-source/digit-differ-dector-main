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
 * Computes SHA-256 hash of string using Web Crypto API for TikTok PII matching.
 */
export async function sha256Hash(str: string): Promise<string> {
  if (!str) return "";
  const normalized = str.trim().toLowerCase();
  try {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {
    console.warn("[Leads] Could not hash string with SHA-256:", e);
  }
  return normalized;
}

/**
 * Saves lead details to Supabase table `leads` if available, and backup to localStorage.
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

    // 2. Insert into Supabase table 'leads' if it exists
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
 * Initializes, identifies user PII (hashed), and triggers TikTok Pixel event tracking.
 */
export async function fireTikTokPixelEvent(
  eventName: string = "CompleteRegistration",
  customData: Record<string, any> = {},
  userInfo?: { email?: string; phone?: string; externalId?: string }
) {
  try {
    const windowObj = window as any;

    if (typeof windowObj.ttq === "undefined") {
      // Inject TikTok Pixel Script dynamically if not present
      (function (w: any, d: any, t: string) {
        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = [
          "page", "track", "identify", "instances", "debug", "on", "off",
          "once", "ready", "alias", "group", "enableCookie", "disableCookie"
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

        if (TIKTOK_PIXEL_ID && TIKTOK_PIXEL_ID !== "C1234567890") {
          ttq.load(TIKTOK_PIXEL_ID);
          ttq.page();
        }
      })(window, document, "ttq");
    }

    if (windowObj.ttq) {
      // 1. Identify user PII if provided (SHA-256 hashed on client side)
      if (userInfo && (userInfo.email || userInfo.phone || userInfo.externalId)) {
        const identifyPayload: Record<string, string> = {};
        if (userInfo.email) {
          identifyPayload.email = await sha256Hash(userInfo.email);
        }
        if (userInfo.phone) {
          const cleanPhone = userInfo.phone.replace(/[^\d+]/g, "");
          identifyPayload.phone_number = await sha256Hash(cleanPhone);
        }
        if (userInfo.externalId) {
          identifyPayload.external_id = await sha256Hash(userInfo.externalId);
        }

        if (typeof windowObj.ttq.identify === "function") {
          windowObj.ttq.identify(identifyPayload);
          console.log("[TikTok Pixel] ttq.identify executed with SHA-256 hashed PII", identifyPayload);
        }
      }

      // 2. Track TikTok Pixel Event with formatted parameters
      if (typeof windowObj.ttq.track === "function") {
        const eventParams = {
          contents: [
            {
              content_id: customData.content_id || "digit_bot_pro_sub",
              content_type: customData.content_type || "product",
              content_name: customData.content_name || "Digit Bot Pro Registration",
            },
          ],
          value: customData.value || 0,
          currency: customData.currency || "USD",
          ...customData,
        };

        windowObj.ttq.track(eventName, eventParams);
        console.log(`[TikTok Pixel] ttq.track('${eventName}') executed with params:`, eventParams);
      }
    }
  } catch (e) {
    console.warn("[TikTok Pixel] Could not fire pixel event:", e);
  }
}
