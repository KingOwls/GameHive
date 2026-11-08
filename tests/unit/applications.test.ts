import { describe, it, expect } from "vitest";
import {
  validApplicationInput,
  parseApplication,
  parseApplicationNotice,
  parseAdminApplication,
} from "../../src/services/critic-applications";
const input = {
  organization: "Independiente",
  experience: "🦊".repeat(40),
  sample: "x".repeat(40),
  links: [],
};
describe("critic applications private contracts", () => {
  it("counts Unicode code points at each boundary", () => {
    expect(validApplicationInput(input)).toBe(true);
    expect(
      validApplicationInput({ ...input, experience: "🦊".repeat(39) }),
    ).toBe(false);
    expect(validApplicationInput({ ...input, sample: "🦊".repeat(5000) })).toBe(
      true,
    );
    expect(validApplicationInput({ ...input, sample: "🦊".repeat(5001) })).toBe(
      false,
    );
  });
  it("accepts at most three HTTPS links without credentials", () => {
    for (const link of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://",
      "https://exa mple.com",
    ])
      expect(validApplicationInput({ ...input, links: [link] })).toBe(false);
    expect(
      validApplicationInput({
        ...input,
        links: Array(4).fill("https://example.com"),
      }),
    ).toBe(false);
    expect(
      validApplicationInput({ ...input, links: ["HTTPS://example.com"] }),
    ).toBe(true);
  });
  it("accepts the actual prior seal on a user snapshot without admitting verified critics", () => {
    const application = {
      ...input,
      id: "71000000-0000-0000-0000-000000000001",
      user_id: "71000000-0000-0000-0000-000000000002",
      expected_role: "user",
      expected_status: "active",
      expected_verified: true,
      status: "pending",
      version: 1,
      created_at: "2026-11-01",
      resolved_at: null,
      resolved_by: null,
      reason: null,
    };
    expect(parseApplication(application).expected_verified).toBe(true);
    expect(() =>
      parseApplication({ ...application, expected_role: "critic" }),
    ).toThrow();
  });
  it("rejects malformed persisted response rather than confirming a write", () => {
    expect(() => parseApplication({ ...input, id: "bad" })).toThrow();
    expect(() => parseApplicationNotice({ reason: "Only a reason" })).toThrow();
  });
});

it("rejects whitespace-only evidence for every JS trim codepoint", () => {
  for (const space of [
    "\n",
    "\r",
    "\t",
    "\u00a0",
    "\u1680",
    "\u2000",
    "\u2028",
    "\u2029",
    "\u202f",
    "\u205f",
    "\u3000",
    "\ufeff",
  ]) {
    expect(
      validApplicationInput({ ...input, experience: space.repeat(40) }),
    ).toBe(false);
    expect(
      validApplicationInput({ ...input, organization: space.repeat(3) }),
    ).toBe(false);
  }
  expect(() =>
    parseAdminApplication({ ...input, current_authority: { role: "bad" } }),
  ).toThrow();
});
