import { describe, expect, it } from "vitest";

import { classifyWhatsAppReply } from "@/lib/domain/whatsapp";

describe("classifyWhatsAppReply", () => {
  it("classifies confirmation language", () => {
    expect(
      classifyWhatsAppReply({ text: { body: "Oui je confirme" } }, "confirmation"),
    ).toBe("confirmed");
  });

  it("classifies address clarifications with delivery details", () => {
    expect(
      classifyWhatsAppReply(
        { text: { body: "Appartement 8, immeuble Atlas, rue Tansift" } },
        "address_clarification",
      ),
    ).toBe("address_updated");
  });

  it("marks ambiguous replies as unclear", () => {
    expect(
      classifyWhatsAppReply({ text: { body: "??" } }, "confirmation"),
    ).toBe("unclear_reply");
  });
});
