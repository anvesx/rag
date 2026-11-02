import { ConnectorError } from "@brain/connector-kit";
import { describe, expect, it } from "vitest";
import { alice, build, ok } from "./support.js";

describe("live acl guards", () => {
  it("rejects with a typed CONFIG error for a connector that does not enforce the user token", async () => {
    await expect(build(ok, false)("t1", ["a"], alice)).rejects.toMatchObject({ name: "RetrievalError", code: "CONFIG" });
    await expect(build(ok, "missing")("t1", ["a"], alice)).rejects.toMatchObject({ code: "CONFIG" });
  });

  it("maps FORBIDDEN to deny", async () => {
    const verify = build(async () => {
      throw new ConnectorError("FORBIDDEN", "403");
    });
    expect(await verify("t1", ["a"], alice)).toEqual(new Map([["a", "deny"]]));
  });
});
