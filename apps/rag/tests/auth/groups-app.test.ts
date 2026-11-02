import { createFakeConnector } from "@anvesx/connector-kit/testing";
import { describe, expect, it } from "vitest";
import { mintToken, signedPrincipalFor } from "../../src/auth/token.js";
import { call, connect, doc, idsOf, start } from "../harness.js";

const secret = "g".repeat(32);

describe("group-only documents over signed tokens", () => {
  it("are visible to a group member and hidden from a non-member", async () => {
    const shared = { ...doc("handbook", []), acl: { allowUsers: [], allowGroups: ["eng"], version: 1 } };
    const { app } = await start({ principalFor: signedPrincipalFor(secret), connectorFor: () => createFakeConnector("fake", [shared]) });
    await app.ingest("t1");
    const member = await connect(app.port, mintToken(secret, "carol", "t1", { groups: ["eng"] }));
    const outsider = await connect(app.port, mintToken(secret, "dave", "t1", { groups: ["sales"] }));
    const bare = await connect(app.port, mintToken(secret, "erin", "t1"));
    expect(idsOf(await call(member))).toEqual(["handbook"]);
    expect(idsOf(await call(outsider))).toEqual([]);
    expect(idsOf(await call(bare))).toEqual([]);
    await Promise.all([member.close(), outsider.close(), bare.close()]);
    await app.close();
  });
});
