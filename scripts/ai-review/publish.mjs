import { readFile } from "node:fs/promises";
import { MARKER, renderComment } from "./review.mjs";

const API = "https://api.github.com";
async function main() {
  const ctx = JSON.parse(await readFile(process.env.FOLIO_REVIEW_CONTEXT_PATH, "utf8"));
  const result = JSON.parse(await readFile(process.env.FOLIO_REVIEW_RESULT_PATH, "utf8"));
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error("missing_comment_token");

  const call = async (path, options = {}) => {
    const response = await fetch(API + path, {
      ...options,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const method = options.method || "GET";
      const operation = path.includes("/pulls/") ? "read_pr"
        : path.includes("/issues/comments/") ? "update_comment"
          : method === "POST" ? "create_comment"
            : "list_comments";
      // Never log response bodies or token values; GitHub permission failures need only operation/status.
      throw new Error("github_api_" + operation + "_http_" + response.status);
    }
    return response.json();
  };

  const repoPath = "/repos/" + ctx.repository;
  const pr = await call(repoPath + "/pulls/" + ctx.number);
  if (pr.head?.sha !== ctx.headSha || pr.base?.sha !== ctx.baseSha || pr.state !== "open") {
    console.log("STALE_REVIEW: PR head/base has changed; no result was published.");
    return;
  }
  if (result.identity?.headSha !== ctx.headSha || result.identity?.baseSha !== ctx.baseSha ||
      result.identity?.repository !== ctx.repository || result.identity?.number !== ctx.number) {
    throw new Error("review_result_identity_mismatch");
  }
  const body = renderComment(ctx, result).slice(0, 59000);
  let owned = null;
  for (let page = 1; page <= 20; page++) {
    const comments = await call(repoPath + "/issues/" + ctx.number + "/comments?per_page=100&page=" + page);
    for (const comment of comments) {
      if (comment.body?.includes(MARKER) && comment.user?.type === "Bot" &&
          comment.user?.login === "github-actions[bot]") {
        owned = comment;
        break;
      }
    }
    if (owned || comments.length < 100) break;
  }

  const endpoint = owned
    ? repoPath + "/issues/comments/" + owned.id
    : repoPath + "/issues/" + ctx.number + "/comments";
  const published = await call(endpoint, {
    method: owned ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  console.log("Folio OpenCode review comment:", published.html_url);
  if (result.state !== "COMPLETED") process.exitCode = 1;
}

main().catch((error) => {
  console.error("Folio review publication failed:", error?.message || "unknown");
  process.exitCode = 1;
});