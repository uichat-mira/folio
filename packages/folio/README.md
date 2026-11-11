# @uichat-mira/folio

Folio is a Git-native documentation, publishing, and project portal runtime for Vite and React.

It keeps Markdown, navigation, routing, SEO, and static deployment inside a stable package contract while allowing every consumer to keep its own UI, branding, and product-specific behavior.

## 0.1.x consumer contract

Markdown rendering is trusted-content-only: raw HTML, `::: html`, and Callout bodies are preserved without sanitization. `styles.css` is a whole-site stylesheet, not an isolated embed stylesheet. The default static document shell works without JavaScript, while custom static route bodies are site-owned.

The canonical boundary list, trusted Markdown example, stylesheet caveats, static-mode comparison, and known limitations live in the [Folio consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md). That file is the single source of truth for these rules. It also records the independent [FOL-014 tarball/UI acceptance](https://github.com/uichat-mira/folio/blob/dev/docs/research/fol-014-default-ui-acceptance.md) and the original missing ambient TypeScript declaration for `virtual:folio/content`, included in the published package.

## Install

Folio `0.1.1` is publicly released through [GitHub Release `folio-v0.1.1`](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1) and the [OIDC publish workflow](https://github.com/uichat-mira/folio/actions/runs/41282326983), following the manual `0.1.0` bootstrap. The patch retains the same public API and ships the corrected installation README. Install the latest Folio with:

```bash
npm install @uichat-mira/folio
```

The independent `registry:consumer` test installs the real npm package and verifies strict TypeScript, public exports, Vite content discovery and static output. Source changes continue through `pack:consumer`. For TypeScript projects that import only the virtual module, register `@uichat-mira/folio` in `compilerOptions.types`.

Within this repository the official site in `apps/site` consumes the package through the npm workspace link, not through the registry. The UIChat Mira documentation site (`uichat-mira/uichat-mira-docs`) is the intended first downstream production consumer, but it still depends on `@uichat-mira/docs` and has not migrated yet.

## Vite integration

```ts
import { defineConfig } from "vite";
import { folio } from "@uichat-mira/folio/vite";

export default defineConfig({
  plugins: [
    folio({
      contentDir: "content",
      config: {
        title: "My docs",
        description: "Documentation",
        siteUrl: "https://example.com",
      },
      staticRoutes: true,
    }),
  ],
});
```

The plugin discovers Markdown, parses YAML Frontmatter, and exposes content through `virtual:folio/content`. It can also generate route-level HTML, canonical and social metadata, JSON-LD, `404.html`, `sitemap.xml`, and `robots.txt`.

## Visual presets and code highlighting (next release)

The current source branch implements the FOL-049 appearance contract. **The npm
`0.1.1` release above does not yet contain these settings.** After a release
from the Folio `prod` lineage, the same `FolioConfig` drives both React and
static output:

```ts
import { defineFolioConfig } from "@uichat-mira/folio";

export default defineFolioConfig({
  title: "Knowledge base",
  description: "Engineering notes and product documentation",
  appearance: {
    preset: "graphite",   // "pearl" | "editorial" | "graphite"
    scheme: "system",    // "light" | "dark" | "system"
    codePalette: "auto", // "auto" | "xuanzhi" | "xuanmo"
  },
});
```

The **unconfigured defaults** are `pearl + system + auto`. Each preset has
light and dark semantic colors. Graphite is a separate *dark-first visual
preset*, not another Color Scheme. `auto` uses Xuanzhi for effective light,
Xuanmo for effective dark; a site can explicitly choose dark code on a light
page without changing the site's scheme. The built-in **home template** is a
separate concern (FOL-050), not chosen by `appearance.preset`.

Folio still has a **single stylesheet entry**:

```ts
import "@uichat-mira/folio/styles.css";
import "./brand.css"; // optional site-owned token values, loaded afterwards
```

Consumer brand CSS can override public role tokens without copying Header,
DocsShell or Markdown component selectors:

```css
:root {
  --folio-primary: #27695b;
  --folio-reading-frame-width: 1180px;
  --folio-code-bg: #f7f5ef;
}
```

The root frame width variables are inherited into `.folio-shell` rather than
shadowed by it. Code colors are independently exposed as
`--folio-code-bg`, `--folio-code-fg`, `--folio-code-border` and
`--folio-syntax-*`. Mermaid resolves current semantic CSS color tokens at
runtime; it is **not** statically pre-rendered as an SVG.

Static output from `folio({ staticRoutes: true })` uses the same site-level
`appearance` config and sets `data-folio-preset` /
`data-folio-code-palette` on the HTML element. An explicit light/dark scheme
also sets `data-folio-theme`; `system` leaves the mode to the reader's CSS
media preference until JavaScript takes over. In React the user theme choice
is stored only after an explicit toggle in `folio-theme-choice`; an automatic
OS-derived effective color is **not** saved as a user preference.

## Optional PWA integration

Folio can make a consumer site installable and keep readers on the current
deployment, without the consumer writing Service Worker registration, update
event or cache-cleanup code. It is **explicitly opt-in**: `folio()` on its own
still emits no manifest and no Service Worker.

```ts
import { defineConfig } from "vite";
import { folio } from "@uichat-mira/folio/vite";
import { folioPwa } from "@uichat-mira/folio/pwa";

const config = {
  title: "My docs",
  description: "Documentation",
  siteUrl: "https://example.com",
};

export default defineConfig({
  base: "/my-docs/", // optional: the same config works at "/"
  plugins: [
    folio({ contentDir: "content", config, staticRoutes: true }),
    folioPwa({
      config,
      icons: [
        { src: "icon-192.png", sizes: "192x192" },
        { src: "icon-512.png", sizes: "512x512" },
        { src: "icon-maskable.png", sizes: "512x512", purpose: "maskable" },
      ],
      themeColor: "#cc785c",
      backgroundColor: "#faf9f5",
    }),
  ],
});
```

Icons are consumer-owned brand assets under `public/`; Folio never infers icon
sizes from `config.logo` and fails the build when the manifest would not be
installable. `start_url` and `scope` follow the Vite `base` automatically, so a
root and a sub-path deployment need no separate configuration.

`vite-plugin-pwa` and `workbox-window` are **optional peer dependencies**:
install them only when you enable this integration.

```bash
npm install --save-dev vite-plugin-pwa workbox-window
```

### Update prompt

Mount the default prompt once, anywhere in your app:

```tsx
import { FolioPwaUpdatePrompt } from "@uichat-mira/folio/pwa/react";

export function App() {
  return (
    <>
      <Site />
      <FolioPwaUpdatePrompt />
    </>
  );
}
```

The default is `updateMode: "prompt"`: a new deployment is prepared in the
background, an accessible prompt (`role="status"`, keyboard reachable, 40px
targets) appears, and the page reloads **only** after the reader confirms.
"Later" dismisses the prompt for the current update; nothing is force-reloaded
while an article is being read. Update checks run at app start and when the tab
returns to the foreground, throttled to one minute
(`FOLIO_PWA_UPDATE_CHECK_INTERVAL_MS`).

For a custom UI, use the hook — it already wraps the official
`virtual:pwa-register/react` client and the throttle:

```tsx
import { useFolioPwaUpdate } from "@uichat-mira/folio/pwa/react";

function MyPrompt() {
  const {
    needRefresh,
    confirmUpdate,
    dismissUpdate,
    checkForUpdate,
    supported,
    registrationState, // "unsupported" | "registering" | "registered" | "failed"
  } = useFolioPwaUpdate({
    checkIntervalMs: 60_000,
    onRegisterError: (error) => console.warn("PWA registration failed", error),
  });
  if (!needRefresh) return null;
  return (
    <div role="status">
      <span>A new version is available.</span>
      <button onClick={() => void dismissUpdate()}>Later</button>
      <button onClick={() => void confirmUpdate()}>Reload</button>
    </div>
  );
}
```

`<FolioPwaUpdatePrompt render={...} />` replaces the default markup while keeping
the same state machine. `updateMode: "auto"` is an explicit alternative for
sites that accept an immediate reload; it must not be combined with prompt UI.

`supported` tells you whether the browser has the Service Worker API at all, and
`registrationState` distinguishes "not registered yet" from "registered" and
"failed" — derived from the official client's callbacks, not from a second
lifecycle implementation. Registration errors still reach `onRegisterError`, and
the site keeps working without offline support.

Icons are validated: they must be square 192 and 512 (plus any maskable
variant), `src` must resolve to a file in the build output, and
`manifest.icons` may not replace the dedicated `icons` option. Precache entries
also stay content-free — `includeAssets` and `workbox.*` may add static assets,
but an entry that resolves to a generated page fails the build.

### What the integration does and does not do

- **Multi-page safe.** No `navigateFallback`, so an unknown URL still reaches the
  real `404.html` instead of silently rendering the home page.
- **No HTML precache.** Only hashed JS/CSS and the brand assets you list are
  precached. Article and document pages stay online, so a stale body cannot
  outlive a publication.
- **No implicit runtime caching.** No API, authenticated or cross-origin
  responses are cached. `workbox.runtimeCaching` remains an explicit consumer
  decision.
- **Outdated precaches are cleaned** (`cleanupOutdatedCaches`) after activation.
- **Content-only publications are detected.** Folio writes a deterministic
  `folio-version.json` (a hash of every generated HTML page) and injects it into
  the Workbox precache manifest, so editing only Markdown still produces a new
  Service Worker and a visible update — the case a plain asset-hash setup misses.
- **Precache entries are resolved, not pattern-matched.** A directory URL, an
  `index` alias or a percent-encoded path that resolves to a generated page is
  rejected on the emitted worker, including entries injected through
  `workbox.manifestTransforms`. Static assets stay precacheable, and an
  unreadable worker manifest fails the build instead of passing silently.
- **Not implemented:** Web Push, offline article reading, background sync and
  offline writes. `disable: true` builds the site without any PWA output.

## Home page customization

The built-in home page has three supported levels. Without any configuration the
current default editorial home, navigation, SEO metadata and static HTML stay
as they are. `FolioConfig.collections` remains the only source for collection
routes; home sections do not hardcode `/blogs` or `/projects`.

1. **Use the default home.** Set no `home` and no `slots.home`.
2. **Configure the built-in home.** `FolioConfig.home` controls block order,
   visibility, the featured/recent collection source, limits and the small
   amount of copy the default design needs. React and the default static build
   consume the same resolved model.
3. **Take full control.** `slots.home` replaces only the React `/` route.
   `staticRoutes.home` replaces only the generated static `/` route body and
   metadata; it does not require copying every other static route. For a fully
   custom static route list, `renderFolioStaticHome({ config, docs, ... })`
   exposes the same configured body and `resolveFolioHome()` exposes the
   platform-neutral model.

```ts
const config = defineFolioConfig({
  title: "Field notes",
  description: "A small journal",
  collections: [
    { path: "/notes", title: "Notes" },
    { path: "/projects", title: "Projects" },
  ],
  home: {
    sections: [
      { type: "intro", title: "Notes from the workshop" },
      { type: "featured", collection: "/notes" },
      { type: "recent", collection: "/notes", limit: 3 },
      { type: "collections", paths: ["/projects"], limit: 2 },
      { type: "about", path: "/info/about", linkLabel: "Read more" },
    ],
  },
});
```

Section order is the array order. Omitting `home.sections` keeps the default
`intro`, `featured`, `recent`, `collections`, `about` order; an empty array
renders only the optional meta strip. Empty collections produce an explicit
empty state, a featured/recent block without entries is omitted or shows the
empty/end message, and a configured `path` that does not match a document fails
the build instead of silently falling back.

For static-only customization, keep the default route set and override `/`:

```ts
const staticBuild: FolioStaticBuildOptions = {
  home: () => ({
    title: "My home",
    description: "The same site, with a custom static home",
    body: '<main><h1>My home</h1><a href="/notes/">Read the notes</a></main>',
  }),
};
```

`staticRoutes.home` is an explicit HTML contract. A React node in `slots.home`
is not serialized into static HTML automatically, and Folio does not add an SSR
renderer for it. Consumers who server-render React own that integration; they
can reuse `resolveFolioHome()` for selection and ordering. When a consumer
supplies a complete `staticRoutes.routes` array, that array remains
authoritative for every route; `home` patches only the `/` route and requires
that array to contain `/`.
The published `0.1.1` package has a built-in home and `slots.home`, but does not
expose the `home` configuration or `staticRoutes.home` contract described here.
See the [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md).

## Documentation navigation components

FolioTreeNav is the single sidebar renderer for ordinary documentation and
project hierarchies. buildFolioNavigationTree(docs, current, { scopePath? })
creates a unified, React-free tree. Collection/section labels are permanent
non-interactive headings; only content nodes with children expose +/- buttons.
By default a project is attached to a collection only when its route belongs
to that collection's authored directories; an unrelated route is never claimed
because multiple directories happen to share the root path. An explicit
scopePath widens the navigation domain when a consumer intends to combine
distant sections. Identically titled sections in different collections remain
separate, and ambiguous projects retain their own group rather than joining a
random namesake.

FolioApp owns a navigation state provider above individual reading routes:
manual expansion survives switching between technical documents and project
articles within a navigation scope; the selected page's ancestors are opened
on route changes. Selected backgrounds outrank hover backgrounds. Consumers
using FolioTreeNav independently can control expansion via expandedPaths and
onExpandChange. FolioToc remains a separate article-heading navigator.

All components use Folio's single CSS entry and support Router basename and
onNavigate for closing mobile drawers.

For route-aware customization use slots.navigation and slots.docToc.
The navigation callback receives { tree, currentPath, onNavigate } for every
reading page, including ordinary docs and project articles. The same callback
works on desktop and mobile; forward onNavigate to close mobile drawers.
React slots do not modify the static HTML renderer, which continues to emit
the default tree and links for no-JS reading.

## Git-native document metadata

`FolioDocMeta` is a compact editorial byline in the reading shells:
initial/avatar, author, date and estimated reading time. Frontmatter `author`
takes precedence over Git `createdBy`, and `publishedAt` takes precedence
over `createdAt`. The optional object form `author: { name, avatar }`
accepts an explicit root-relative or HTTP(S) image. Git-backed authors use
verified GitHub noreply identities or a bounded, best-effort build-time commit
API lookup for GitHub remotes. Offline or unknown identities use a square
initial avatar. The browser never calls GitHub API or exposes Git author email.
Set `FOLIO_GITHUB_AVATARS=0` to disable build-time API lookups; noreply and
explicit images still work. Editorial authors different from the Git commit
author never inherit that commit author's avatar.

The complete Git history fields remain on `FolioDoc`: first/last commit
timestamps and authors populate `createdAt`, `updatedAt`, `createdBy` and
`updatedBy`, each independently overridable in Frontmatter. `author` and
`publishedAt` remain editorial facts rather than synonyms for Git provenance.
Untracked files have no inferred values; incomplete history never invents a
first commit. `getFolioDocMeta(doc)` preserves the full field model, while
`getFolioDocByline(doc)` is the shared presentation model used by React and
`renderFolioStaticDocMeta(doc)` from `@uichat-mira/folio/vite`.

## Previous/next page navigation

FolioPageNav is the exported, presentational previous/next component.
Pass `previous` and/or `next` as `{ path, title }` and optionally `className`
or `ariaLabel`. It returns no markup when neither neighbor exists. With one
neighbor, the opposite column remains empty to preserve alignment.

Default reader ordering comes from `getFolioNavigationNeighbors(tree, currentPath)`
on the same `buildFolioNavigationTree(docs, currentDoc)` as the left sidebar.
Traversal includes embedded project pages and then the next document in the
same collection (e.g., the final component page continues to Reference Index).
Standalone project trees remain bounded to their top-level project. The narrower
`getFolioDocNeighbors` and `getFolioTreeNeighbors` remain available for explicit
consumer use, and `pageNeighbors` can override the default in `FolioDocsShell`.
Static document and project builds follow the identical neighbor resolver and
emit base-aware links. Custom static document renderers can import
`renderFolioStaticPageNav(context, doc)` from `@uichat-mira/folio/vite`
rather than hand-implementing their own pagination.

## Path-derived project hierarchy

Project content can follow a folder convention without a separate navigation
manifest or a parent field:

- projects/alpha/index.md -> /projects/alpha (project overview)
- projects/alpha/story/index.md -> /projects/alpha/story (child article)
- projects/alpha/story/notes/index.md -> /projects/alpha/story/notes (nested article)

With type: project, FolioApp automatically renders the project tree in the
standard reading shell. The overview is a clickable parent and children are
ordered by frontmatter order. Missing overview pages become non-clickable
directory labels instead of broken links. The route path is authoritative:
explicit frontmatter path overrides also change inferred navigation ancestry.

FolioTreeNav renders every left sidebar through FolioTreeBranch. Collection
sections such as API/Deployment are labels, always visible and never toggles.
Content parent titles remain router links; + / − at the far right is a separate
disclosure button sharing one row background, active state and subtle hover.
Selected rows remain visually stronger than hovered rows. The child region
animates to its actual height, while hidden descendants are inert and cannot
receive focus. The animation obeys prefers-reduced-motion.

FolioTreeExpansionProps keeps defaultExpanded, expandedPaths, and
onExpandChange for consumers controlling disclosure state. Setting
collapsible=false removes disclosure buttons and leaves every descendant
link visible and focusable. Static HTML likewise keeps all descendant links
visible without inert controls.

Consumers can call buildFolioNavigationTree(docs, currentDoc, { scopePath })
for a unified documentation and project tree, or buildFolioContentTree for a
standalone hierarchy. FolioTreeNav renders both. The single slots.navigation
callback replaces the entire sidebar for either reading page type; the
consumer receives the assembled Core tree rather than re-deriving it.

The static build uses the same Core content tree. Custom staticRoutes consumers
can call renderFolioStaticProjectShell(context, doc, markdownHtml?) from the
published vite entry. The default static builder uses it automatically for
type: project routes. No separate static project metadata is maintained.

## Site footer

The built-in FolioApp footer remains backward compatible with the original
string config and the no-config default. The structured footer config provides
optional brand identity (including a logo), link groups, copyright,
registration links, and legal destinations. Set footer to false to hide the
default footer, or use slots.footer for full React markup replacement.
The public FolioFooter component can also be composed directly inside a router.

When FolioApp renders its documentation reading shell (both doc and project
pages), ui.footerOnDocs=false hides the site footer and articleFooter together.
The option name is kept for compatibility, but its policy is based on the
rendered layout, not a special case for project routes. Home, articles and
collection indexes are unaffected. Consumers building their own shells can
reuse resolveFolioReaderKind and shouldShowFolioPageFooter to make the same
presentation decision.

The official site uses this structured API, including deployment-base-aware
logo assets; no organization branding or filing claims are baked into the
package. Static route prerendering covers route bodies and does not automatically
render the React app-shell footer.

## React runtime

Use the default lightweight runtime:

```tsx
import { FolioApp } from "@uichat-mira/folio";
import "@uichat-mira/folio/styles.css";
```

Or consume the content model and virtual manifest from an existing React application while preserving its current pages and visual system.

`@uichat-mira/folio/styles.css` is a whole-site default stylesheet: it targets `:root`, `*`, `body`, `a`, and `button, input`, so it assumes Folio owns the document. Importing it into an existing branded page affects that page globally, and 0.1.0 has no scoped embed entry. The [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md) lists the affected rules and the override guidance.

## Markdown compatibility rendering

Consumers with custom page shells can reuse Folio's compatibility renderer instead of maintaining a second static Markdown pipeline:

```ts
import { renderFolioMarkdown } from "@uichat-mira/folio";

const html = renderFolioMarkdown(source, {
  removeH1: true,
});
```

It preserves `::: html` blocks, renders `::: tip` blocks, escapes fenced code, provides a readable Mermaid fallback, and adds stable anchors to level-two through level-four headings (`h2`–`h4`).

> **Trusted content only.** The renderer preserves raw HTML and does not sanitize event attributes, `javascript:` URLs, or unsafe SVG/MathML content. Pass only Markdown that was reviewed and merged by people you trust to publish on the site. Unreviewed pull requests, user submissions, and scraped pages are not supported input in 0.1.0. See the [consumer contract](https://github.com/uichat-mira/folio/blob/dev/docs/consumer-contract.md).

## What the package owns

- Content parsing and normalized entry types
- Configurable built-in home selection, ordering and static home override
- Vite content discovery and hot updates
- Stable route and navigation data
- Markdown and HTML heading extraction
- Reusable Markdown compatibility rendering
- Static publishing and metadata contracts
- GitHub Pages base-path handling

Consumer applications remain responsible for branding, page composition, custom author models, and product-specific interaction.

## Exports

- `@uichat-mira/folio` — content model, React runtime, Markdown rendering, and configuration helpers
- `@uichat-mira/folio/vite` — Markdown discovery, virtual manifests, and static output
- `@uichat-mira/folio/pwa` — optional Vite PWA integration (`folioPwa()`, content version helper)
- `@uichat-mira/folio/pwa/react` — optional update prompt and throttled update hook
- `@uichat-mira/folio/styles.css` — whole-site default stylesheet (not an isolated embed stylesheet)

## Project status

Verified on 2026-11-01:

- **Done** — `0.1.0` public npm bootstrap, independent Registry consumer verification, public entrypoints, local tarball checks and official site's workspace build.
- **Release lineage** — `0.1.0` was bootstrapped manually without a Folio GitHub Release. `0.1.1` is the first actual OIDC-published [Folio GitHub Release](https://github.com/uichat-mira/folio/releases/tag/folio-v0.1.1). The initial post-publish Registry visibility probe timed out while npm processed the package; the workflow rerun passed full Registry consumer acceptance without republishing. This README is not a live status feed.
- **Separate work** — migrate downstream Mira Docs consumers from `@uichat-mira/docs`. Historical MiraDocs tag `v0.1.0` remains untouched. The OIDC publish is evidenced by GitHub Actions; the private npm settings dashboard is a distinct administrative UI.

The predecessor `@uichat-mira/docs` package stays available for existing consumers during migration.
