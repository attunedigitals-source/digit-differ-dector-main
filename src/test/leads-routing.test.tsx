// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TikTokLanding from "@/pages/TikTokLanding";
import ThankYou2 from "@/pages/ThankYou2";
import RegistrationPage from "@/pages/RegistrationPage";
import ThankYou1 from "@/pages/ThankYou1";
import ClientPortal from "@/pages/ClientPortal";
import { submitLead, associateDerivAccount, getCapturedLeads, loginClientUser } from "@/lib/leads";

afterEach(() => {
  cleanup();
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Not found") }),
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }), eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
    }),
  },
}));

describe("Lead Generation, Client Portal & Deriv Association", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders TikTok Landing Page 2 and submits lead with password", async () => {
    render(
      <MemoryRouter>
        <TikTokLanding />
      </MemoryRouter>
    );

    expect(screen.getByText(/Get Instant VIP Access/i)).toBeDefined();

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const phoneInput = screen.getByPlaceholderText(/\+2348012345678/i);
    const passInput = screen.getByPlaceholderText(/Create a password/i);
    const confirmPassInput = screen.getByPlaceholderText(/Confirm your password/i);
    const submitBtn = screen.getByRole("button", { name: /Join WhatsApp & Continue/i });

    fireEvent.change(emailInput, { target: { value: "tiktoklead@example.com" } });
    fireEvent.change(phoneInput, { target: { value: "+2348123456789" } });
    fireEvent.change(passInput, { target: { value: "Secret123!" } });
    fireEvent.change(confirmPassInput, { target: { value: "Secret123!" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const stored = localStorage.getItem("digit_bot_captured_leads");
      expect(stored).toBeTruthy();
      expect(stored || "").toContain("tiktoklead@example.com");
      expect(stored || "").toContain("Secret123!");
    });
  });

  it("authenticates registered client user and logs into portal", async () => {
    await submitLead({
      name: "Lekan Client",
      email: "lekan@example.com",
      phone: "+2348011112222",
      password: "MyPassword123",
      source: "organic_direct",
    });

    const res = await loginClientUser("lekan@example.com", "MyPassword123");
    expect(res.success).toBe(true);
    expect(res.name).toBe("Lekan Client");

    const currentClient = localStorage.getItem("current_client_user");
    expect(currentClient).toContain("Lekan Client");
  });

  it("renders ClientPortal page with personalized 'You are Welcome, Lekan Client!' greeting", () => {
    localStorage.setItem(
      "current_client_user",
      JSON.stringify({ email: "lekan@example.com", name: "Lekan Client" })
    );

    render(
      <MemoryRouter>
        <ClientPortal />
      </MemoryRouter>
    );

    expect(screen.getByText(/You are Welcome,/i)).toBeDefined();
    expect(screen.getByText(/Lekan Client/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Connect to Deriv/i })).toBeDefined();
  });

  it("associates Deriv account ID to submitted lead email", async () => {
    await submitLead({
      name: "John Lead",
      email: "johnlead@example.com",
      phone: "+2348099998888",
      source: "tiktok_paid",
    });

    let leads = await getCapturedLeads();
    expect(leads[0].email).toBe("johnlead@example.com");

    await associateDerivAccount("CR998877", ["CR998877", "VRTC112233"]);

    leads = await getCapturedLeads();
    expect(leads[0].derivLoginId).toBe("CR998877");
  });

  it("deletes lead record across storage and Supabase payload", async () => {
    const { deleteLeadRecord } = await import("@/lib/leads");

    await submitLead({
      name: "ToDelete Lead",
      email: "todelete@example.com",
      phone: "+2348011223344",
      source: "organic_direct",
    });

    let leads = await getCapturedLeads();
    expect(leads.some((l) => l.email === "todelete@example.com")).toBe(true);

    const deleted = await deleteLeadRecord("todelete@example.com");
    expect(deleted).toBe(true);

    leads = await getCapturedLeads();
    expect(leads.some((l) => l.email === "todelete@example.com")).toBe(false);
  });
});
