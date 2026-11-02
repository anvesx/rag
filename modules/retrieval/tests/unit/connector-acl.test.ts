import { type Connector, ConnectorError } from "@anvesx/connector-kit";
import type { Pointer, Principal } from "@anvesx/core-types";
import { describe, expect, it } from "vitest";
import { createConnectorLiveAcl } from "../../src/index.js";

const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
const pointer = (id: string) => ({ id, address: `addr-${id}` }) as Pointer;
/** Answers per address: a reader list, "boom" (generic failure) or a thrown non-Error. Records (address, token) per call. */
function source(rules: Record<string, string[] | "boom" | "odd">) {
  const calls: Array<[string, string]> = [];
  const connector: Connector = {
    id: "s",
    enforcesUserToken: true,
    list: async () => ({ items: [] }),
    async fetch(address, { token }) {
      calls.push([address, token]);
      const rule = rules[address.replace("addr-", "")];
      if (rule === "boom") throw new Error("source unavailable");
      if (rule === "odd") throw "not an Error";
      if (!rule?.includes(token)) throw new ConnectorError("NOT_FOUND", address);
      return { text: "x", version: "v1" };
    },
  };
  return { calls, connector };
}

const make = (s: ReturnType<typeof source>, over: { token?: string | undefined; known?: string[] } = {}) => {
  const known = over.known ?? ["a", "b", "c"];
  const token = "token" in over ? over.token : "user-alice";
  return createConnectorLiveAcl({
    connectorFor: (t) => (t === "t1" ? s.connector : undefined),
    userTokenFor: () => token,
    pointerFor: (_t, id) => (known.includes(id) ? pointer(id) : undefined),
  });
};

describe("createConnectorLiveAcl", () => {
  it("allows what the user's token reads and denies what the source hides (not found)", async () => {
    const verify = make(source({ a: ["user-alice"], b: ["user-bob"] }));
    expect(await verify("t1", ["a", "b"], alice)).toEqual(
      new Map([
        ["a", "allow"],
        ["b", "deny"],
      ]),
    );
  });

  it("reads each address once, in order, with the user's token", async () => {
    const s = source({ a: ["user-alice"], b: ["user-alice"] });
    await make(s)("t1", ["a", "b"], alice);
    expect(s.calls).toEqual([
      ["addr-a", "user-alice"],
      ["addr-b", "user-alice"],
    ]);
  });

  it("is unknown when the source fails for any reason other than not found, even a non-Error throw", async () => {
    const verdicts = await make(source({ a: "boom", b: "odd", c: ["user-alice"] }))("t1", ["a", "b", "c"], alice);
    expect(verdicts).toEqual(
      new Map([
        ["a", "unknown"],
        ["b", "unknown"],
        ["c", "allow"],
      ]),
    );
  });

  it("is unknown for every id without a token, without a connector for the tenant, or for an unknown pointer, and never calls out", async () => {
    const s = source({ a: ["user-alice"] });
    const unknown = new Map([["a", "unknown"]]);
    expect(await make(s, { token: undefined })("t1", ["a"], alice)).toEqual(unknown);
    expect(await make(s)("t9", ["a"], alice)).toEqual(unknown);
    expect(await make(s, { known: [] })("t1", ["a"], alice)).toEqual(unknown);
    expect(s.calls).toEqual([]);
  });

  it("answers for exactly the ids it was given", async () => {
    expect(await make(source({}))("t1", [], alice)).toEqual(new Map());
  });
});
