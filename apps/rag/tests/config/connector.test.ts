import { describe, expect, it } from "vitest";
import { connectorFromEnv } from "../../src/cli/connectors.js";
import { readEnv } from "../../src/config/index.js";

const base = { RAG_TENANT: "acme" };
const build = (env: Record<string, string>) => connectorFromEnv(readEnv({ ...base, ...env }), { ...base, ...env });

describe("RAG_CONNECTOR", () => {
  it("rejects an unknown connector and a missing tenant", () => {
    expect(() => readEnv({ RAG_CONNECTOR: "s3", RAG_TENANT: "acme" })).toThrow("invalid RAG_CONNECTOR: s3");
    expect(() => readEnv({ RAG_CONNECTOR: "github" })).toThrow("RAG_TENANT is required");
  });
  it("is the demo when nothing is chosen, and folder when only a root is given", () => {
    expect(build({})).toBeUndefined();
    expect(build({ RAG_FOLDER_ROOT: "/docs" })?.connector.id).toBe("folder");
  });
  it("names every missing setting in one message", () => {
    expect(() => build({ RAG_CONNECTOR: "github" })).toThrow("RAG_CONNECTOR=github needs GITHUB_TOKEN, RAG_GITHUB_REPO (owner/repo)");
    expect(() => build({ RAG_CONNECTOR: "github", GITHUB_TOKEN: "t", RAG_GITHUB_REPO: "no-slash" })).toThrow("RAG_GITHUB_REPO");
    expect(() => build({ RAG_CONNECTOR: "drive" })).toThrow("RAG_CONNECTOR=drive needs DRIVE_ACCESS_TOKEN");
    expect(() => build({ RAG_CONNECTOR: "folder" })).toThrow("RAG_FOLDER_ROOT");
  });
  it("builds connectors that enforce the user's own token, indexing with the configured token", () => {
    const github = build({ RAG_CONNECTOR: "github", GITHUB_TOKEN: "ght", RAG_GITHUB_REPO: "acme/handbook" });
    expect([github?.connector.id, github?.connector.enforcesUserToken, github?.token]).toEqual(["github", true, "ght"]);
    const drive = build({ RAG_CONNECTOR: "drive", DRIVE_ACCESS_TOKEN: "dat" });
    expect([drive?.connector.id, drive?.connector.enforcesUserToken, drive?.token]).toEqual(["drive", true, "dat"]);
    expect(build({ RAG_CONNECTOR: "folder", RAG_FOLDER_ROOT: "/docs" })?.connector.enforcesUserToken).toBeFalsy();
  });
});
