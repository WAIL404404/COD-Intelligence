import { describe, expect, it } from "vitest";

import { classifyWhatsAppReply } from "@/lib/domain/whatsapp";
import {
  buildWhatsAppTemplatePayload,
  toWhatsAppLanguageCode,
} from "@/lib/integrations/whatsapp";

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

describe("WhatsApp template sending", () => {
  it("maps French locale to Meta language code and builds a template payload", () => {
    expect(toWhatsAppLanguageCode("fr-MA")).toBe("fr");

    expect(
      buildWhatsAppTemplatePayload({
        to: "+212612345678",
        templateName: "cod_confirmation_fr",
        languageCode: "fr",
        parameters: ["Atlas Home", "#1001", "420 MAD"],
      }),
    ).toMatchObject({
      to: "+212612345678",
      type: "template",
      template: {
        name: "cod_confirmation_fr",
        language: { code: "fr" },
      },
    });
  });
});
