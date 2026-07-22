import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  email: string;
  phone: string;
  source: "tiktok_paid" | "organic_direct";
  whatsappOptIn?: boolean;
  name?: string;
}

export const TIKTOK_PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || "C1234567890";
export const WHATSAPP_GROUP_URL = import.meta.env.VITE_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/";

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
 * Initializes and triggers TikTok Pixel event tracking on Thank You Page 2.
 */
export function fireTikTokPixelEvent(eventName: string = "CompleteRegistration", customData: Record<string, any> = {}) {
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

    if (windowObj.ttq && typeof windowObj.ttq.track === "function") {
      windowObj.ttq.track(eventName, customData);
      console.log(`[TikTok Pixel] Event '${eventName}' tracked with Pixel ID '${TIKTOK_PIXEL_ID}'`, customData);
    }
  } catch (e) {
    console.warn("[TikTok Pixel] Could not fire pixel event:", e);
  }
}
