import { type Reply, type Request, startReplay } from "./replay.js";

/** Tokens the replayed sources accept: the indexer and alice read; bob's own token was revoked at the source (404). */
export const INDEX_TOKEN = "index-token";
const readable = (req: Request): boolean => /^(Bearer|token) (index-token|alice-token)$/.test(req.authorization ?? "");

const TEXT = "needle: reimbursement is paid within ten days of the claim";
const NOT_FOUND: Reply = { status: 404, body: { message: "Not Found", error: { code: 404, message: "not found" } } };
const gated = (ok: Reply) => (req: Request) => (readable(req) ? ok : NOT_FOUND);

/** The GitHub REST shapes the real Octokit client needs for repo acme/handbook: one private repo, collaborators alice and bob, one document. */
export const replayGithub = () => {
  const root = "/repos/acme/handbook";
  const sha = "3d21ec53a331a6f037a91c368710b99387d012c1";
  return startReplay({
    [root]: () => ({
      status: 200,
      body: {
        id: 1,
        name: "handbook",
        full_name: "acme/handbook",
        private: true,
        default_branch: "main",
        pushed_at: "2026-10-30T09:14:02Z",
        updated_at: "2026-10-30T09:14:05Z",
      },
    }),
    [`${root}/git/trees/main`]: () => ({
      status: 200,
      body: {
        sha: "9fb037999f264ba9281fc6cbd2d9dff8d1c1d5b1",
        truncated: false,
        tree: [{ path: "guide.md", mode: "100644", type: "blob", sha, size: TEXT.length }],
      },
    }),
    [`${root}/collaborators`]: () => ({ status: 200, body: [{ login: "alice" }, { login: "bob" }] }),
    [`${root}/teams`]: () => NOT_FOUND,
    [`${root}/contents/guide.md`]: gated({
      status: 200,
      body: { type: "file", encoding: "base64", size: TEXT.length, name: "guide.md", path: "guide.md", sha, content: Buffer.from(TEXT).toString("base64") },
    }),
  });
};

/** The Drive v3 shapes the real client needs: one plain-text file shared with alice and bob, no further pages. */
export const replayDrive = () => {
  const file = "/drive/v3/files/doc1";
  const permissions = [
    { id: "p1", type: "user", role: "owner", emailAddress: "alice@acme.test" },
    { id: "p2", type: "user", role: "reader", emailAddress: "bob@acme.test" },
  ];
  return startReplay({
    "/drive/v3/files": () => ({
      status: 200,
      body: { files: [{ id: "doc1", name: "policy.txt", mimeType: "text/plain", version: "3", modifiedTime: "2026-10-28T14:03:11.000Z", permissions }] },
    }),
    [file]: (req) =>
      !readable(req)
        ? NOT_FOUND
        : { status: 200, body: req.url.searchParams.get("alt") === "media" ? TEXT : { id: "doc1", mimeType: "text/plain", version: "3" } },
  });
};
