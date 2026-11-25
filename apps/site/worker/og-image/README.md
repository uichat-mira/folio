# WeChat OG image worker

Serves one stable `og:image` URL whose bytes depend on the requesting user agent:

- `MicroMessenger` / `WeChat` / a `servicewechat.com` referer → `/folio/icon-512.png`, the square mark without the wordmark.
- Everyone else → `/folio/folio-og-1200x630.png`, the wide brand card.

This keeps a single `<meta property="og:image">` in the static HTML while giving WeChat link previews the square mark. It does not proxy HTML and does not change the public site URL.

## Deploy

```bash
cd apps/site/worker/og-image
npx wrangler login
npx wrangler deploy
```

The command prints a `https://folio-og-image.<account>.workers.dev` URL. Verify both branches:

```bash
curl -sI -A "Mozilla/5.0 MicroMessenger/8.0.50" https://<worker>/og
curl -sI -A "Twitterbot/1.0" https://<worker>/og
```

The response carries `x-folio-og-variant: wechat` or `x-folio-og-variant: default`. Check that `content-length` matches the expected image.

## Enable it for the site

Set the GitHub repository variable `FOLIO_OG_IMAGE_URL` to the deployed `/og` URL, for example:

```text
https://folio-og-image.<account>.workers.dev/og
```

The Pages build passes that variable to Vite. `apps/site/vite.config.ts` uses it as the default social image and omits fixed width/height metadata because the two variants have different dimensions.

For the custom domain `https://folio-og.tomz.io/og`:

1. Make sure the `tomz.io` zone is in the same Cloudflare account.
2. Uncomment the `routes` block in `wrangler.toml`.
3. Run `npx wrangler deploy`; Wrangler creates the proxied DNS record and certificate.
4. Set `FOLIO_OG_IMAGE_URL=https://folio-og.tomz.io/og`.

Prefer the custom domain over `*.workers.dev`: the WeChat crawler runs from
mainland China, where `workers.dev` is often unreachable.

## Caveats

- WeChat caches link previews. Verify with a fresh URL or wait for the cache to expire.
- If WeChat's image fetcher does not send `MicroMessenger` or a `servicewechat.com` referer, it receives the wide card. In that case the image endpoint cannot distinguish WeChat; the next step would be an HTML-level Worker proxy.
- The worker returns `Cache-Control: no-store` and `Vary: User-Agent, Referer` so a shared cache cannot pin one variant for every crawler.
