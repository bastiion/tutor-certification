import { describe, expect, test } from "bun:test";
import { classifyVerifyFile, VERIFY_FUTURE_PDF_MIME } from "./verifyInboundMime.ts";

describe("classifyVerifyFile", () => {
  test("json by mime and extension", () => {
    expect(classifyVerifyFile(new File([], "a.json", { type: "" }))).toBe("json");
    expect(classifyVerifyFile(new File([], "x", { type: "application/json" }))).toBe("json");
  });

  test("image", () => {
    expect(classifyVerifyFile(new File([], "x.png", { type: "" }))).toBe("image");
    expect(classifyVerifyFile(new File([], "x", { type: "image/png" }))).toBe("image");
  });

  test("pdf returns unknown until implemented", () => {
    expect(classifyVerifyFile(new File([], "x.pdf", { type: "" }))).toBe("unknown");
    expect(classifyVerifyFile(new File([], "x", { type: VERIFY_FUTURE_PDF_MIME }))).toBe("unknown");
  });

  test("pdf mime with parameter", () => {
    expect(classifyVerifyFile(new File([], "x", { type: "application/pdf; charset=binary" }))).toBe("unknown");
  });

  test("unknown mime/extension", () => {
    expect(classifyVerifyFile(new File([], "x.txt", { type: "text/plain" }))).toBe("unknown");
  });
});
