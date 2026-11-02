import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";
import { titleOf } from "./harness.js";

const child = fileURLToPath(new URL("./fixtures/stdio-child.mjs", import.meta.url));
const open: Client[] = [];
afterEach(async () => Promise.all(open.splice(0).map((c) => c.close())));

async function spawnClient(principal?: string): Promise<{ client: Client; transport: StdioClientTransport }> {
  const env = { ...process.env, ...(principal ? { TEST_PRINCIPAL: principal } : {}) } as Record<string, string>;
  const transport = new StdioClientTransport({ command: process.execPath, args: [child], env });
  const client = new Client({ name: "t", version: "1" });
  await client.connect(transport);
  open.push(client);
  return { client, transport };
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("stdio transport (spawned child)", () => {
  it("lists the search tool and returns pointers for the resolved principal", async () => {
    const { client } = await spawnClient("alice");
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["search"]);
    const result = await client.callTool({ name: "search", arguments: { query: "plan" } });
    expect(titleOf(result)).toBe("alice:plan");
  });

  it("serves concurrent children independently", async () => {
    const [a, b] = await Promise.all([spawnClient("a"), spawnClient("b")]);
    const [ra, rb] = await Promise.all([
      a.client.callTool({ name: "search", arguments: { query: "x" } }),
      b.client.callTool({ name: "search", arguments: { query: "y" } }),
    ]);
    expect([titleOf(ra), titleOf(rb)]).toEqual(["a:x", "b:y"]);
  });

  it("child exits once the client closes", async () => {
    const { client, transport } = await spawnClient();
    const pid = transport.pid as number;
    expect(alive(pid)).toBe(true);
    await client.close();
    await expect.poll(() => alive(pid), { timeout: 5000 }).toBe(false);
  });
});
