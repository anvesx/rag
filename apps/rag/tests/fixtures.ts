import type { FakeDoc } from "@anvesx/connector-kit";

export const doc = (address: string, users: string[], text = "needle"): FakeDoc => ({
  address,
  title: address,
  version: "v1",
  acl: { allowUsers: users, allowGroups: [], version: 1 },
  zone: "team",
  updatedAt: "2026-11-01T00:00:00.000Z",
  text,
});

export const docs = () => [doc("a", ["alice"]), doc("b", ["alice"]), doc("hidden", ["bob"])];
/** The second tenant's own documents, distinct from `docs()`. */
export const docs2 = () => [doc("x", ["alice"]), doc("y", ["alice"]), doc("hidden2", ["bob"])];
