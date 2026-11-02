import { type Connector, ConnectorError } from "@brain/connector-kit";
import type { Pointer, Principal } from "@brain/core-types";
import { describe, expect, it } from "vitest";
import { toSearchFn } from "../../src/adapter.js";
import { createConnectorLiveAcl, RetrievalError } from "../../src/index.js";

const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };

const verdictFor = async (failure: unknown) => {
  const connector: Connector = {
    id: "s",
    enforcesUserToken: true,
    list: async () => ({ items: [] }),
    fetch: async () => {
      throw failure;
    },
  };
  const acl = createConnectorLiveAcl({
    connectorFor: () => connector,
    pointerFor: (_t: string, id: string) => ({ id, address: `addr-${id}` }) as Pointer,
    userTokenFor: () => "user-alice",
  });
  return (await acl("t1", ["a"], alice)).get("a");
};

describe("connector live ACL verdict mapping", () => {
  it("denies only a ConnectorError with code NOT_FOUND", async () => {
    expect(await verdictFor(new ConnectorError("NOT_FOUND", "x"))).toBe("deny");
  });

  it("stays unknown for a ConnectorError with any other code", async () => {
    expect(await verdictFor(new ConnectorError("PATH_ESCAPE", "x"))).toBe("unknown");
  });

  it("stays unknown for a plain Error that merely carries a NOT_FOUND code", async () => {
    expect(await verdictFor(Object.assign(new Error("x"), { code: "NOT_FOUND" }))).toBe("unknown");
  });
});

describe("toSearchFn failure", () => {
  it("carries a human readable message", async () => {
    const error = await toSearchFn(async () => ({ ok: false, code: "LIVE_ACL" }))({ query: "q", limit: 1, principal: alice }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RetrievalError);
    expect((error as Error).message).toBe("live acl check failed");
  });
});
