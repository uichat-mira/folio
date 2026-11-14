// Optional build-time GitHub commit-author association.
// A Git author name/email alone is not a GitHub identity. For ordinary emails
// GitHub's commit API must associate the exact commit with a user. No email,
// credential, or API response is sent to the browser: only a verified avatar URL.
import { execFileSync } from "node:child_process";

export type GithubAvatarCandidate = { email: string; sha: string };
export type GithubAvatarIdentity = { login: string; avatarUrl: string };

const MAX_AUTHORS_PER_REPOSITORY = 12;
// A brief GitHub/connection failure must not turn into a permanent missing avatar
// for the lifetime of a Vite dev server. Successful identities can stay cached.
const FAILED_LOOKUP_RETRY_MS = 60_000;
const cache = new Map<string, { identity: GithubAvatarIdentity | null; retryAfter?: number }>();

const GH_LOOKUP_SCRIPT = String.raw`
const https = require("node:https");
const input = JSON.parse(process.argv[1]);
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const headers = {
  "User-Agent": "folio-git-author-avatar",
  Accept: "application/vnd.github+json",
  ...(token ? { Authorization: "Bearer " + token } : {}),
};
async function lookup(item) {
  return new Promise((resolve) => {
    const path = "/repos/" + input.repo + "/commits/" + item.sha;
    let body = "";
    const req = https.get({ hostname: "api.github.com", path, headers, timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 256000) req.destroy();
      });
      res.on("end", () => {
        try {
          const user = JSON.parse(body).author;
          resolve(user && typeof user.login === "string" && Number.isSafeInteger(user.id)
            ? { login: user.login, id: user.id } : null);
        } catch { resolve(null); }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}
Promise.all(input.commits.map(lookup)).then((users) => process.stdout.write(JSON.stringify(users)));
`;

export function githubRepositoryFromRemote(origin: string | undefined): string | undefined {
  const match = origin?.trim().match(
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  );
  return match ? `${match[1]}/${match[2]}` : undefined;
}

export function githubNoreplyAvatar(email: string): GithubAvatarIdentity | undefined {
  const match = email.trim().match(
    /^(?:(\d+)\+)?([A-Za-z\d](?:[A-Za-z\d-]{0,37}[A-Za-z\d])?)@users\.noreply\.github\.com$/i,
  );
  if (!match) return undefined;
  const login = match[2];
  // The numeric GitHub account ID remains valid even when a login changes.
  const avatarUrl = match[1]
    ? `https://avatars.githubusercontent.com/u/${match[1]}?s=64`
    : `https://github.com/${login}.png?size=64`;
  return { login, avatarUrl };
}

/**
 * Resolve distinct commit-author emails once per build/process. This is a
 * best-effort enhancement, never a build requirement. Only GitHub remotes are
 * queried; other Git servers and offline builds retain the letter fallback.
 */
export function githubAvatarsForAuthors(
  remote: string | undefined,
  authors: GithubAvatarCandidate[],
): Map<string, GithubAvatarIdentity> {
  const resolved = new Map<string, GithubAvatarIdentity>();
  const repo = githubRepositoryFromRemote(remote);
  const allowApi = process.env.FOLIO_GITHUB_AVATARS !== "0";
  const pending: GithubAvatarCandidate[] = [];

  for (const candidate of authors) {
    if (!candidate.email || !/^[a-f\d]{40}$/i.test(candidate.sha)) continue;
    const noreply = githubNoreplyAvatar(candidate.email);
    if (noreply) {
      resolved.set(candidate.email, noreply);
      continue;
    }
    if (!repo || !allowApi || resolved.has(candidate.email) || pending.some((p) => p.email === candidate.email)) continue;
    const key = `${repo.toLowerCase()}|${candidate.email.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached?.identity) {
      resolved.set(candidate.email, cached.identity);
    } else if (cached?.retryAfter && cached.retryAfter > Date.now()) {
      // Suppress repeated network attempts during rapid development rebuilds.
      continue;
    } else if (pending.length < MAX_AUTHORS_PER_REPOSITORY) {
      pending.push(candidate);
    }
  }

  if (!repo || !pending.length) return resolved;

  try {
    // The synchronous Vite virtual-module contract is preserved. HTTPS
    // lookups run concurrently in one subprocess with a fixed upper bound.
    const output = execFileSync(process.execPath, [
      "-e", GH_LOOKUP_SCRIPT,
      JSON.stringify({ repo, commits: pending.map(({ sha }) => ({ sha })) }),
    ], { encoding: "utf8", timeout: 8_000, maxBuffer: 64 * 1024, windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"] });
    const users: unknown = JSON.parse(output);
    pending.forEach((candidate, index) => {
      const key = `${repo.toLowerCase()}|${candidate.email.toLowerCase()}`;
      const user = Array.isArray(users) ? users[index] as { login?: unknown; id?: unknown } | null : null;
      const identity = user && typeof user.login === "string" &&
        /^[A-Za-z\d-]{1,39}$/.test(user.login) &&
        typeof user.id === "number" && Number.isSafeInteger(user.id) && user.id > 0
        ? { login: user.login, avatarUrl: `https://avatars.githubusercontent.com/u/${user.id}?s=64` }
        : null;
      cache.set(key, identity
        ? { identity }
        : { identity: null, retryAfter: Date.now() + FAILED_LOOKUP_RETRY_MS });
      if (identity) resolved.set(candidate.email, identity);
    });
  } catch {
    // Never block or fail a local/offline build on GitHub availability.
    for (const candidate of pending) {
      cache.set(`${repo.toLowerCase()}|${candidate.email.toLowerCase()}`,
        { identity: null, retryAfter: Date.now() + FAILED_LOOKUP_RETRY_MS });
    }
  }
  return resolved;
}
