import { describe, expect, it } from "vitest";
import { start } from "../harness.js";

const readyz = async (port: number | undefined) => {
  const res = await fetch(`http://127.0.0.1:${port}/readyz`);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe("/readyz while the embedding model loads", () => {
  it("is 503 until the model can load, then 200", async () => {
    let loadable = false;
    const ready = () => (loadable ? Promise.resolve() : Promise.reject(new Error("model not downloaded")));
    const { app } = await start({ ready, healthPort: 0 });
    expect(await readyz(app.healthPort)).toEqual({ status: 503, body: { status: "unavailable" } });
    loadable = true;
    expect(await readyz(app.healthPort)).toEqual({ status: 200, body: { status: "ready" } });
    await app.close();
  });

  it("is 503 when the load does not finish within the probe limit, and does not hang", async () => {
    const never = new Promise<void>(() => undefined);
    const { app } = await start({ ready: () => never, healthPort: 0, timeouts: { embedQueryMs: 50 } });
    const started = Date.now();
    expect((await readyz(app.healthPort)).status).toBe(503);
    expect(Date.now() - started).toBeLessThan(2000);
    await app.close();
  });

  it("is 200 when the app has no model to wait for", async () => {
    const { app } = await start({ healthPort: 0 });
    expect((await readyz(app.healthPort)).status).toBe(200);
    await app.close();
  });
});
