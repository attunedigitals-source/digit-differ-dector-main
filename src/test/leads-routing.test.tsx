// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TikTokLanding from "@/pages/TikTokLanding";
import ThankYou2 from "@/pages/ThankYou2";
import RegistrationPage from "@/pages/RegistrationPage";
import ThankYou1 from "@/pages/ThankYou1";
import { submitLead } from "@/lib/leads";

afterEach(() => {
  cleanup();
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

// Mock submitLead
vi.mock("@/lib/leads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/leads")>();
  return {
    ...actual,
    submitLead: vi.fn().mockResolvedValue({ success: true, message: "Lead submitted" }),
    fireTikTokPixelEvent: vi.fn(),
  };
});

describe("Lead Generation and Traffic Funnel Pages", () => {
  it("renders TikTok Landing Page 2 and submits lead for paid traffic", async () => {
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
      expect(submitLead).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "tiktoklead@example.com",
          phone: "+2348123456789",
          source: "tiktok_paid",
        })
      );
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

  it("renders Organic Registration Page and submits lead for direct traffic", async () => {
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
      expect(submitLead).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "organic@example.com",
          phone: "+2348987654321",
          source: "organic_direct",
        })
      );
    });
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
