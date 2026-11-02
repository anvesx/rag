import { describe, expect, it, vi } from "vitest";
import { call, connect, start, tamper } from "../harness.js";

const logger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() });
const text = (r: unknown) => (r as { content: Array<{ text: string }> }).content[0]?.text;

describe("rag app logging", () => {
  it("an audit failure logs the cause while the client sees only the generic error", async () => {
    const log = logger();
    const { app, auditDbPath } = await start({ logger: log });
    await app.ingest("t1");
    tamper(auditDbPath, "DROP TABLE audit");
    const client = await connect(app.port, "alice:t1");
    const result = await call(client, "secret-query-text");
    expect(text(result)).toBe("Search failed");
    expect(log.error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(log.error.mock.calls);
    expect(logged).toMatch(/audit/i);
    expect(logged).not.toContain("secret-query-text");
    expect(logged).not.toContain("alice:t1");
    await client.close();
    await app.close();
  });

  it("logs nothing on a successful search", async () => {
    const log = logger();
    const { app } = await start({ logger: log });
    await app.ingest("t1");
    const client = await connect(app.port, "alice:t1");
    await call(client);
    expect(log.error).not.toHaveBeenCalled();
    await client.close();
    await app.close();
  });
});
