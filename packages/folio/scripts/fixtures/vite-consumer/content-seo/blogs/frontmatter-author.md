---
title: Consumer article with explicit metadata
description: Frontmatter authors and dates must reach the generated JSON-LD.
author:
  - name: Frontmatter Author
    url: https://example.test/authors/frontmatter
  - name: Second Author
publishedAt: 2025-02-03T04:05:06Z
updatedAt: 2025-03-04T05:06:07Z
---

# Consumer article with explicit metadata

This article is built by the installed tarball in SEO mode. Its frontmatter
author list must override the site-level author, and the explicit
`publishedAt` / `updatedAt` values must become `datePublished` /
`dateModified` and the sitemap `<lastmod>`.
