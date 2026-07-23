// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TikTokLanding from "@/pages/TikTokLanding";
import ThankYou2 from "@/pages/ThankYou2";
import RegistrationPage from "@/pages/RegistrationPage";
import ThankYou1 from "@/pages/ThankYou1";
import { submitLead, associateDerivAccount, getCapturedLeads } from "@/lib/leads";

afterEach(() => {
  cleanup();
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }),
    }),
  },
}));

describe("Lead Generation, Deriv Association & Funnel Pages", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders TikTok Landing Page 2 and calls lead submission handler", async () => {
    render(
      <MemoryRouter>
        <TikTokLanding />
      </MemoryRouter>
    );

    expect(screen.getByText(/Get Instant VIP Access/i)).toBeDefined();

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const phoneInput = screen.getByPlaceholderText(/\+2348012345678/i);
    const submitBtn = screen.getByRole("button", { name: /Join WhatsApp & Continue/i });

    fireEvent.change(emailInput, { target: { value: "tiktoklead@example.com" } });
    fireEvent.change(phoneInput, { target: { value: "+2348123456789" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const stored = localStorage.getItem("digit_bot_captured_leads");
      expect(stored).toContain("tiktoklead@example.com");
    });
  });

  it("renders Thank You Page 2 and displays WhatsApp & Login links", () => {
    render(
      <MemoryRouter>
        <ThankYou2 />
      </MemoryRouter>
    );

    expect(screen.getByText(/Registration Complete!/i)).toBeDefined();
    expect(screen.getByText(/Join VIP WhatsApp Group/i)).toBeDefined();
    expect(screen.getByText(/Proceed to Login & Launch App/i)).toBeDefined();
  });

  it("renders Organic Registration Page and submits lead to storage", async () => {
    render(
      <MemoryRouter>
        <RegistrationPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Register Account/i)).toBeDefined();

    const emailInput = screen.getByPlaceholderText(/you@example.com/i);
    const phoneInput = screen.getByPlaceholderText(/\+2348012345678/i);
    const submitBtn = screen.getByRole("button", { name: /Register & Continue/i });

    fireEvent.change(emailInput, { target: { value: "organic@example.com" } });
    fireEvent.change(phoneInput, { target: { value: "+2348987654321" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const stored = localStorage.getItem("digit_bot_captured_leads");
      expect(stored).toContain("organic@example.com");
    });
  });

  it("associates Deriv account ID to submitted lead email", async () => {
    // 1. Submit lead
    await submitLead({
      name: "John Lead",
      email: "johnlead@example.com",
      phone: "+2348099998888",
      source: "tiktok_paid",
    });

    let leads = await getCapturedLeads();
    expect(leads[0].email).toBe("johnlead@example.com");
    expect(leads[0].derivLoginId).toBeUndefined();

    // 2. Associate Deriv Account CR998877
    await associateDerivAccount("CR998877", ["CR998877", "VRTC112233"]);

    // 3. Verify association
    leads = await getCapturedLeads();
    expect(leads[0].derivLoginId).toBe("CR998877");
    expect(leads[0].derivAccounts).toEqual(["CR998877", "VRTC112233"]);
  });

  it("renders Thank You Page 1 for organic traffic", () => {
    render(
      <MemoryRouter>
        <ThankYou1 />
      </MemoryRouter>
    );

    expect(screen.getByText(/Thank You for Registering!/i)).toBeDefined();
    expect(screen.getByText(/Join WhatsApp Group/i)).toBeDefined();
    expect(screen.getByText(/Click Here to Login & Launch App/i)).toBeDefined();
  });
});
