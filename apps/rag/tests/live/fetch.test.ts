import type { Pointer } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { textFetcher } from "../../src/runtime/fetch.js";
import { defaultGrants, guarded } from "./support.js";

const pointer = (tenantId: string, address: string) => ({ tenantId, address }) as Pointer;

describe("textFetcher", () => {
  it("returns an injected fetchText unchanged", () => {
    const injected = async () => "x";
    expect(textFetcher({ fetchText: injected, connectorFor: () => undefined, tokenFor: () => undefined })).toBe(injected);
  });

  it("otherwise reads through the tenant's connector with the tenant credential", async () => {
    const source = guarded(defaultGrants());
    const fetch = textFetcher({ connectorFor: (t) => (t === "t1" ? source : undefined), tokenFor: (t) => (t === "t1" ? "token-t1" : undefined) });
    expect(await fetch(pointer("t1", "a"))).toBe("needle");
    expect(source.calls).toEqual([["a", "token-t1"]]);
  });

  it("rejects for a tenant without a connector or credential, and passes an empty credential through", async () => {
    const source = guarded(defaultGrants());
    const fetch = textFetcher({ connectorFor: (t) => (t === "t1" ? source : undefined), tokenFor: (t) => (t === "t1" ? "" : undefined) });
    await expect(fetch(pointer("t9", "a"))).rejects.toThrow("no connector or credential for tenant t9");
    await expect(fetch(pointer("t1", "a"))).resolves.toBe("needle");
  });

  it("rejects when either the connector or the credential is missing, and never reads the source", async () => {
    const source = guarded(defaultGrants());
    const noToken = textFetcher({ connectorFor: () => source, tokenFor: () => undefined });
    const noConnector = textFetcher({ connectorFor: () => undefined, tokenFor: () => "token-t1" });
    await expect(noToken(pointer("t1", "a"))).rejects.toThrow("no connector or credential for tenant t1");
    await expect(noConnector(pointer("t1", "a"))).rejects.toThrow("no connector or credential for tenant t1");
    expect(source.calls).toEqual([]);
  });
});
