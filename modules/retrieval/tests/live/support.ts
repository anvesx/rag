import type { Connector } from "@brain/connector-kit";
import type { Pointer, Principal } from "@brain/core-types";
import { createConnectorLiveAcl } from "../../src/index.js";

export const alice: Principal = { id: "alice", tenantId: "t1", groups: [] };
export const ok = async () => ({ text: "x", version: "1" });

export function build(fetch: Connector["fetch"], flag: boolean | "missing" = true, concurrency?: number) {
  const connector: Connector = { id: "s", list: async () => ({ items: [] }), fetch, ...(flag !== "missing" && { enforcesUserToken: flag }) };
  return createConnectorLiveAcl({
    connectorFor: () => connector,
    userTokenFor: () => "tok",
    pointerFor: (_t, id) => ({ id, address: id }) as Pointer,
    ...(concurrency !== undefined && { concurrency }),
  });
}
