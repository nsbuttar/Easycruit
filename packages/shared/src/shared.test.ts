import assert from "node:assert/strict";
import { test } from "node:test";
import { atsMatchPatterns, detectAts } from "./ats-platforms.ts";
import { fieldDescriptorSchema, rawMappingSchema, reconcileMapping } from "./mapping.ts";
import { candidateProfileSchema, pruneProfile } from "./profile.ts";

const field = (overrides: Record<string, unknown>) =>
  fieldDescriptorSchema.parse({ ref: "f1", kind: "text", ...overrides });

test("detectAts recognises supported hosts and rejects lookalikes", () => {
  assert.equal(detectAts("https://acme.wd5.myworkdayjobs.com/en-US/careers")?.id, "workday");
  assert.equal(detectAts("https://boards.greenhouse.io/acme/jobs/1")?.id, "greenhouse");
  assert.equal(detectAts("https://jobs.lever.co/acme/123")?.id, "lever");
  assert.equal(detectAts("https://evilgreenhouse.io/acme"), null);
  assert.equal(detectAts("https://greenhouse.io.evil.com/acme"), null);
  assert.equal(detectAts("not a url"), null);
});

test("atsMatchPatterns emits apex and wildcard patterns", () => {
  const patterns = atsMatchPatterns();
  assert.ok(patterns.includes("https://*.greenhouse.io/*"));
  assert.ok(patterns.includes("https://lever.co/*"));
});

test("profile schema tolerates nulls and missing sections from the model", () => {
  const profile = candidateProfileSchema.parse({
    firstName: "Ada",
    lastName: null,
    contactInfo: null,
    workHistory: [{ company: "Analytical Engines", bullets: null }],
    skills: "not-an-array",
  });
  assert.equal(profile.lastName, "");
  assert.equal(profile.contactInfo.email, "");
  assert.deepEqual(profile.workHistory[0]?.bullets, []);
  assert.deepEqual(profile.skills, []);
  assert.equal(profile.screeningAnswers.requiresSponsorship, "");
});

test("pruneProfile drops blank rows and duplicate skills", () => {
  const profile = candidateProfileSchema.parse({
    workHistory: [{}, { company: "Acme", bullets: ["", "Built things"] }],
    skills: ["TypeScript", "", "TypeScript"],
  });
  const pruned = pruneProfile(profile);
  assert.equal(pruned.workHistory.length, 1);
  assert.deepEqual(pruned.workHistory[0]?.bullets, ["Built things"]);
  assert.deepEqual(pruned.skills, ["TypeScript"]);
});

test("reconcileMapping keeps confident fills and reports everything else", () => {
  const fields = [
    field({ ref: "a", label: "First name" }),
    field({ ref: "b", kind: "select", label: "Country", options: ["Canada", "United States"] }),
    field({ ref: "c", kind: "textarea", label: "Why us?" }),
    field({ ref: "d", kind: "checkbox", label: "I agree" }),
    field({ ref: "e", kind: "radio", label: "Sponsorship?", options: ["Yes", "No"] }),
  ];
  const raw = rawMappingSchema.parse({
    fills: [
      { ref: "a", value: "Ada", confidence: 0.99 },
      { ref: "b", value: "united states", confidence: 0.9 },
      { ref: "c", value: "Because.", confidence: 0.2 },
      { ref: "d", value: true, confidence: 0.95 },
      { ref: "e", value: "Maybe", confidence: 0.95 },
      { ref: "ghost", value: "x", confidence: 1 },
    ],
    unmapped: [{ ref: "c", reason: "Open-ended question" }],
  });

  const result = reconcileMapping(fields, raw);

  assert.deepEqual(
    result.fills.map((fill) => [fill.ref, fill.value]),
    [
      ["a", "Ada"],
      ["b", "United States"],
      ["d", "true"],
    ],
  );
  assert.deepEqual(result.unmapped, [
    { ref: "c", reason: "Open-ended question" },
    { ref: "e", reason: "No confident match in your profile" },
  ]);
});

test("reconcileMapping treats an empty model response as fully unmapped", () => {
  const result = reconcileMapping([field({ ref: "a" })], rawMappingSchema.parse({}));
  assert.deepEqual(result.fills, []);
  assert.equal(result.unmapped.length, 1);
});
