import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyContent, TermsContent } from "@/components/legal-pages";
import { SiteFooter } from "@/components/site-footer";
import { CONTACT_EMAIL } from "@/lib/site";

// 운영자 사이트 공통 문의 주소 통일(#12): 보이는 문의 주소는 1bangkr.info@gmail.com 하나뿐이어야 한다.
describe("contact email", () => {
  it("uses the shared operator inbox", () => {
    expect(CONTACT_EMAIL).toBe("1bangkr.info@gmail.com");
  });

  it.each([
    ["footer", () => <SiteFooter />],
    ["privacy policy", () => <PrivacyContent />],
    ["terms", () => <TermsContent />]
  ])("shows only the shared address in the %s", (_name, ui) => {
    const { container } = render(ui());
    const text = container.textContent ?? "";
    expect(text).toContain("1bangkr.info@gmail.com");
    expect(text).not.toContain("cyjung@gmail.com");
  });
});
