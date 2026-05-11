import { describe, expect, test } from "bun:test";
import { sessionEndorsementMessage } from "./sessionMessage.ts";

describe("sessionEndorsementMessage", () => {
  test("matches hand-built concatenation", () => {
    const courseId = "course-xyz";
    const validUntilUnix = 1_738_836_782;
    const kCoursePublicRaw = new Uint8Array(32);
    kCoursePublicRaw.fill(0xcd);

    const msg = sessionEndorsementMessage(courseId, validUntilUnix, kCoursePublicRaw);

    expect(msg.length).toBe(new TextEncoder().encode(courseId).length + 8 + 32);

    const enc = new TextEncoder();
    const idLen = enc.encode(courseId).length;
    expect([...msg.subarray(0, idLen)]).toEqual([...enc.encode(courseId)]);

    const view = new DataView(msg.buffer, msg.byteOffset + idLen, 8);
    expect(view.getBigUint64(0, false)).toBe(BigInt(validUntilUnix));

    expect([...msg.subarray(idLen + 8)]).toEqual([...kCoursePublicRaw]);
  });

  test("golden bytes for fixed vector", () => {
    const courseId = "a";
    const validUntilUnix = 42;
    const kCoursePublicRaw = Uint8Array.from({ length: 32 }, (_, i) => i);

    const msg = sessionEndorsementMessage(courseId, validUntilUnix, kCoursePublicRaw);

    expect(Buffer.from(msg).toString("hex")).toBe(
      "61000000000000002a000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
  });
});
