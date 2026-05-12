import { describe, expect, test } from "bun:test";
import { classifyTutorInboundFile } from "./inboundMime.ts";

describe("inboundMime", () => {
  test("classify by extension when type empty", () => {
    expect(classifyTutorInboundFile(new File([], "x.json", { type: "" }))).toBe("json");
    expect(classifyTutorInboundFile(new File([], "a.eml", { type: "" }))).toBe("emailMessage");
    expect(classifyTutorInboundFile(new File([], "b.mbox", { type: "" }))).toBe("mbox");
  });

  test("classify by mime", () => {
    expect(classifyTutorInboundFile(new File([], "x", { type: "application/json" }))).toBe("json");
    expect(classifyTutorInboundFile(new File([], "x", { type: "application/json; charset=utf-8" }))).toBe("json");
    expect(classifyTutorInboundFile(new File([], "x", { type: "message/rfc822" }))).toBe("emailMessage");
    expect(classifyTutorInboundFile(new File([], "x", { type: "application/mbox" }))).toBe("mbox");
  });

  test("unknown", () => {
    expect(classifyTutorInboundFile(new File([], "x.bin", { type: "application/octet-stream" }))).toBe("unknown");
  });
});
