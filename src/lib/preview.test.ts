import { describe, expect, it } from "vitest";
import { parseLocalUrl } from "./preview";

describe("parseLocalUrl", () => {
  it("accepts local dev servers, with or without a scheme", () => {
    expect(parseLocalUrl("http://localhost:5173")).toBe("http://localhost:5173/");
    expect(parseLocalUrl("localhost:3000/app")).toBe("http://localhost:3000/app");
    expect(parseLocalUrl("127.0.0.1:8080")).toBe("http://127.0.0.1:8080/");
    expect(parseLocalUrl("https://localhost:5443")).toBe("https://localhost:5443/");
    expect(parseLocalUrl("http://[::1]:4000")).toBe("http://[::1]:4000/");
  });

  it("refuses everything that is not this computer", () => {
    for (const bad of [
      "https://example.com",
      "http://192.168.1.5:3000",
      "http://localhost.evil.com",
      "http://evil.com/localhost",
      "http://user:pw@localhost:3000",
      "file:///C:/secret.txt",
      "javascript:alert(1)",
      "",
      "   ",
      "not a url",
    ]) {
      expect(parseLocalUrl(bad), bad).toBeNull();
    }
  });
});
