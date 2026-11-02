import { expect, test } from "@playwright/test";
import { search } from "../src/mcp.ts";
import { type Server, startServer } from "../src/server.ts";

let server: Server;
test.beforeAll(async () => {
  server = await startServer();
});
test.afterAll(async () => {
  expect(await server.stop()).toBe(0);
});

test("rejects a request with no token", async ({ request }) => {
  const res = await request.post(server.url, { data: {} });
  expect(res.status()).toBe(401);
});

test("alice sees the demo documents", async ({ request }) => {
  const out = await search(request, server.url, "alice:acme", "welcome");
  expect(out).toContain("welcome");
});

test("another tenant never sees acme documents", async ({ request }) => {
  const out = await search(request, server.url, "alice:globex", "welcome");
  expect(out).toContain(String.raw`{\"results\":[]}`);
});

test("a user outside the ACL sees nothing", async ({ request }) => {
  const out = await search(request, server.url, "bob:acme", "welcome");
  expect(out).toContain(String.raw`{\"results\":[]}`);
});
