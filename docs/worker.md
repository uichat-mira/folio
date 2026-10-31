# Paid External Worker (FOL-011)

Folio uses the Organization's pinned reusable Mira External Worker. It is a separate execution channel from DSH; **do not assign the same Issue to DSH and the cloud Worker simultaneously**.

A Folio maintainer with current repository write access may post the **entire** new comment `/worker run` on an open, non-PR Issue containing a real task contract, or manually run **Mira External Worker** with `workflow_dispatch` and that Issue number. Edited comments, bots, users without write access, closed Issues, PR conversations and empty contracts cannot authorize a run. One Issue is serialized across enrollment and execution.

The paid route is fixed to `opencode-go/deepseek-v4.1-flash` and requires `AI_PROVIDER_OPENCODE_GO_KEY` to be available as a GitHub Actions Secret (repository or inherited Organization scope). Missing credentials cause an explicit failure, not a free-model fallback. The Caller uses the current frozen Organization Workflow SHA recorded in its `uses` field, works from `dev`, has a 60-minute limit, and executes Node 22 `npm ci`, package typecheck, package build and package tests. The existing PR CI independently runs full `release:check` and Windows package/consumer validation; this Caller does not weaken or replace those gates.

Successful runs produce only a `feat/* → dev` **Draft PR** with Issue, base SHA, model route, verification command/result, and Actions evidence. The implementation Worker cannot merge, accept/close the Issue, promote branches, make releases or publish npm. A separate reviewer and maintainer decide acceptance.

**Activation caveat:** Folio's default branch is `prod`. GitHub loads `issue_comment` callers from the default branch. A feature PR or merge into `dev` alone **does not activate** `/worker run`. Review and explicitly promote through `dev → test → prod` first. Any real paid smoke requires **a separately authorized lightweight test Issue**; do not use existing feature Issues. Until promotion, secret availability and a real smoke are proven, record the paid-dispatch path as **not runtime-verified**.
