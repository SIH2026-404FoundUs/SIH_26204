import { describe, test, expect } from "@jest/globals";
import { resolveDestId } from "./destinationResolver.js";

describe("resolveDestId — against the real seed data (src/seeds/destinations/)", () => {
  test("exact match: the destination's own name resolves to its slug", () => {
    expect(resolveDestId("Shimla")).toBe("shimla");
  });

  test("close/fuzzy match: extra words around the exact place name still resolve correctly", () => {
    expect(resolveDestId("It's near the mall in Shimla")).toBe("shimla");
  });

  test("a full sentence describing the property, with the place name embedded, still resolves", () => {
    expect(resolveDestId("My homestay is right next to Golconda Fort")).toBe("golconda-hyderabad");
  });

  test("no match found: stays null, does not fabricate a nearby-sounding guess", () => {
    expect(resolveDestId("We have hot water and good food, two rooms available.")).toBeNull();
  });

  test("no match found: a place name that genuinely isn't in the seed data", () => {
    expect(resolveDestId("It's in Ooty.")).toBeNull();
  });

  test("empty/whitespace-only transcript resolves to null, not a false match", () => {
    expect(resolveDestId("")).toBeNull();
    expect(resolveDestId("   ")).toBeNull();
  });

  describe("genuinely ambiguous case in the real seed data", () => {
    // Confirmed directly against the seed files before writing this:
    // exactly three destinations have "Hyderabad" in their displayName
    // (charminar-hyderabad, golconda-hyderabad, hussain-sagar-hyderabad).
    // Saying only the district name, with no more specific place name, is
    // genuinely ambiguous among these three real destinations — this
    // must resolve to null, not silently pick one.
    test("\"Hyderabad\" alone is ambiguous among three real destinations -- resolves to null", () => {
      expect(resolveDestId("It's in Hyderabad.")).toBeNull();
      expect(resolveDestId("Somewhere in Hyderabad")).toBeNull();
    });

    test("but naming the SPECIFIC place within Hyderabad still resolves unambiguously", () => {
      // Proves the ambiguity is genuinely about specificity, not a
      // blanket failure to ever resolve anything Hyderabad-adjacent.
      expect(resolveDestId("Near Charminar in Hyderabad")).toBe("charminar-hyderabad");
      expect(resolveDestId("Close to Hussain Sagar, Hyderabad")).toBe("hussain-sagar-hyderabad");
    });

    test("\"Kinnaur\" alone is similarly ambiguous between two real destinations", () => {
      // Second real ambiguous case, independent confirmation of the same
      // tier-2-tie behavior: chhitkul and kalpa are both "..., Kinnaur,
      // Himachal Pradesh".
      expect(resolveDestId("Somewhere in Kinnaur")).toBeNull();
    });
  });

  test("case-insensitive and punctuation-insensitive", () => {
    expect(resolveDestId("SHIMLA!!")).toBe("shimla");
    expect(resolveDestId("shimla,")).toBe("shimla");
  });

  test("does not match a place name as a mid-word substring of an unrelated word", () => {
    // "kasol" is a real destination name; "kasoline" must not match it.
    expect(resolveDestId("We sell kasoline nearby.")).toBeNull();
  });
});
