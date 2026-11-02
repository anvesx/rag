import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTiers } from "../../src/tiers.ts";
import { cleanFixtures, fixture, packageJson } from "./fixture.js";

afterEach(cleanFixtures);

const manifest = (name: string, dependencies: Record<string, string> = {}) =>
  [`${name}/package.json`, packageJson(`@brain/${name.split("/")[1]}`, dependencies)] as const;

const dirs = (root: string, entries: (readonly [string, string])[]) => entries.map(([path]) => join(root, path, ".."));

describe("tier direction rule", () => {
  it("allows only the documented downward dependency edges", () => {
    const entries = [
      manifest("features/core-types"),
      manifest("features/one", { "@brain/core-types": "workspace:*" }),
      manifest("services/api", { "@brain/one": "workspace:*" }),
      manifest("modules/search", { "@brain/api": "workspace:*", "@brain/one": "workspace:*" }),
      manifest("apps/web", { "@brain/search": "workspace:*", "@brain/api": "workspace:*", "@brain/one": "workspace:*" }),
      manifest("tools/lint"),
    ];
    const root = fixture(Object.fromEntries(entries));
    expect(checkTiers(root, dirs(root, entries))).toEqual([]);
  });

  it("reports sideways, upward, tool-to-app and anything-to-tool dependencies", () => {
    const entries = [
      manifest("features/core-types"),
      manifest("features/one"),
      manifest("features/two", { "@brain/one": "workspace:*" }),
      manifest("services/a"),
      manifest("services/b", { "@brain/a": "workspace:*" }),
      manifest("modules/m", { "@brain/m2": "workspace:*" }),
      manifest("modules/m2"),
      manifest("apps/web", { "@brain/a": "workspace:*", "@brain/web2": "workspace:*" }),
      manifest("apps/web2", { "@brain/lint": "workspace:*" }),
      manifest("tools/lint", { "@brain/one": "workspace:*", "@brain/m": "workspace:*", "@brain/web2": "workspace:*" }),
    ];
    const root = fixture(Object.fromEntries(entries));
    const found = checkTiers(root, dirs(root, entries));
    expect(found).toHaveLength(6);
    expect(found.filter((item) => item.message.includes("@brain/lint"))).toHaveLength(2);
    expect(found[0]?.file).toBe("features/two/package.json");
    expect(found[0]?.message).toContain("may not depend on @brain/one");
  });

  it("checks every dependency field and ignores third-party packages", () => {
    const root = fixture({
      "features/core-types/package.json": packageJson("@brain/core-types"),
      "features/a/package.json": packageJson("@brain/a"),
      "features/b/package.json": JSON.stringify({
        name: "@brain/b",
        devDependencies: { "@brain/a": "*" },
        peerDependencies: { "@brain/a": "*" },
        optionalDependencies: { "@brain/a": "*", zod: "*" },
      }),
    });
    const packages = ["core-types", "a", "b"].map((name) => ({
      dir: join(root, "features", name),
      tier: "feature" as const,
    }));
    expect(checkTiers(root, packages)).toHaveLength(3);
  });

  it("raises typed errors for malformed or duplicate manifests", () => {
    const run = (content: string) => {
      const root = fixture({ "features/a/package.json": content });
      return () => checkTiers(root, [join(root, "features/a")]);
    };
    expect(run("{")).toThrow(/invalid JSON/);
    for (const value of ["null", "{}", JSON.stringify({ name: 1 })]) expect(run(value)).toThrow(/package name is missing/);
    for (const value of [null, [], "bad"]) expect(run(JSON.stringify({ name: "@brain/a", dependencies: value }))).toThrow(/must be an object/);
    const root = fixture({
      "features/a/package.json": packageJson("same"),
      "features/b/package.json": packageJson("same"),
    });
    expect(() => checkTiers(root, [join(root, "features/a"), join(root, "features/b")])).toThrow(/must be unique/);
  });
});
