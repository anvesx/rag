import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { displayPath, type PackageInfo, StructureLintError, type Tier, type Violation } from "./fs/walk.ts";

type Manifest = { name: string; dependencies: string[] };
const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const allowed: Record<Tier, readonly Tier[]> = {
  feature: [],
  service: ["feature"],
  module: ["service", "feature"],
  app: ["module", "service", "feature"],
  tool: ["module", "service", "feature"],
};

const readManifest = (dir: string): Manifest => {
  const path = join(dir, "package.json");
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new StructureLintError(`invalid JSON in ${path}`, { cause });
  }
  if (typeof value !== "object" || value === null || !("name" in value) || typeof value.name !== "string")
    throw new StructureLintError(`package name is missing in ${path}`);
  const record = value as Record<string, unknown>;
  const dependencies = fields.flatMap((field) => {
    const group = record[field];
    if (group === undefined) return [];
    if (typeof group !== "object" || group === null || Array.isArray(group)) throw new StructureLintError(`${field} must be an object in ${path}`);
    return Object.keys(group);
  });
  return { name: value.name, dependencies };
};

export const checkTiers = (root: string, packages: readonly PackageInfo[] | readonly string[]): Violation[] => {
  const tiers: Record<string, Tier> = {
    features: "feature",
    services: "service",
    modules: "module",
    apps: "app",
    tools: "tool",
  };
  const infos: PackageInfo[] = packages.map((item) => (typeof item === "string" ? { dir: item, tier: tiers[basename(dirname(item))] ?? "tool" } : item));
  const manifests = infos.map((info) => ({ info, manifest: readManifest(info.dir) }));
  const byName = new Map(manifests.map((item) => [item.manifest.name, item]));
  if (byName.size !== manifests.length) throw new StructureLintError("workspace package names must be unique");
  return manifests.flatMap(({ info, manifest }) =>
    manifest.dependencies.flatMap((dependency) => {
      const target = byName.get(dependency);
      if (!target) return [];
      const coreTypes = dependency === "@anvesx/core-types" && manifest.name !== dependency;
      if (coreTypes || allowed[info.tier].includes(target.info.tier)) return [];
      return [
        {
          file: displayPath(root, join(info.dir, "package.json")),
          rule: "tiers",
          message: `${manifest.name} (${info.tier}) may not depend on ${dependency} (${target.info.tier})`,
        },
      ];
    }),
  );
};
