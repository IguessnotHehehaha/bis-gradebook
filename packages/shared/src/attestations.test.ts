import { describe, expect, it } from "vitest";
import { attestationAverage, attestationScoreSchema } from "./index";

describe("attestation results", () => {
  it("requires both marks without treating a missing score as zero", () => {
    expect(attestationAverage(null, null)).toBeNull();
    expect(attestationAverage(80, null)).toBeNull();
    expect(attestationAverage(null, 60)).toBeNull();
  });
  it("accepts a real zero and averages equal-weight attestations", () => {
    expect(attestationAverage(0, 100)).toBe(50);
    expect(attestationAverage(80, 90)).toBe(85);
    expect(attestationAverage(72.51, 80.02)).toBe(76.27);
  });
  it("validates score format, range, period and student/course identifiers", () => {
    const input = { courseId: 1, studentId: 2, attestationNumber: 1, score: "72,5" };
    expect(attestationScoreSchema.parse(input).score).toBe(72.5);
    for (const score of ["", "-1", "100.01", "abc", "NaN"]) {
      expect(attestationScoreSchema.safeParse({ ...input, score }).success).toBe(false);
    }
    expect(attestationScoreSchema.safeParse({ ...input, attestationNumber: 3 }).success).toBe(false);
    expect(attestationScoreSchema.safeParse({ ...input, courseId: 0 }).success).toBe(false);
    expect(attestationScoreSchema.safeParse({ ...input, studentId: -1 }).success).toBe(false);
  });
});
