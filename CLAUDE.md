# Station Driver Board — repo notes

- `index.html` here is the Claude artifact "Station Driver Board" PLUS app-only lines. When copying the artifact's HTML into this repo, re-insert this right after the first `</style>` in `<head>` (it is NOT in the artifact):

```html
<link rel="manifest" href="manifest.json"><meta name="theme-color" content="#232f3e"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Station Board"><link rel="apple-touch-icon" href="apple-touch-icon.png?v=2"><link rel="icon" href="icon-192.png?v=2"><script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));</script>
```

- App icon: `icon.png` (512), `icon-192.png`, `apple-touch-icon.png` (180) — DBEL Logistics logo on dark background, logo within the center 70% so circle masks don't clip it. When changing icons, bump the `?v=` and the cache name in `sw.js`.
- `dispatch.html` = dispatch package-report page (password = same as board Dispatch log, via Supabase RPC `read_package_reports`).
- Always ask Matt before pushing.
