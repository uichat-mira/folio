---
title: Consumer article using the site author
description: The configured site author is the fallback when frontmatter has none.
---

# Consumer article using the site author

This article has no frontmatter author, so the generated JSON-LD must use
`config.author`. It also has no explicit dates, so `datePublished` must stay
absent (the Git first commit is not a publication date) while `dateModified`
may use the latest commit.
