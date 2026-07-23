# App Links / Universal Links association files

These let the mobile app (`mercado_ahorros_mobile_app`) open member links that use this domain,
e.g. `https://crm.dev.mercadoahorros.net/customers/123?tab=equipment`, instead of the browser.
They must be reachable, over HTTPS with **no redirect**, at:

- `https://<host>/.well-known/assetlinks.json` (Android App Links)
- `https://<host>/.well-known/apple-app-site-association` (iOS Universal Links)

Next.js serves everything under `public/` at the site root, so these files publish automatically.

## Before this actually works — fill the placeholders

1. **`assetlinks.json` → `sha256_cert_fingerprints`**: the SHA-256 of the **app signing** cert
   (Play App Signing key for production; the debug keystore for local testing). Get it with:
   `keytool -list -v -keystore <keystore> -alias <alias>` — copy the SHA-256 line.
2. **`apple-app-site-association` → `appIDs`**: `<TeamID>.<BundleID>`. The Xcode team is
   `SKAGC4WT49` and the bundle id is `com.example.mercadoAhorrosMobile` (both placeholders from the
   scaffold — update to the real App Store identifiers before release).
3. **`package_name`** in `assetlinks.json`: currently `com.example.mercado_ahorros_mobile` (the
   scaffold `applicationId`) — update to the production Android application id.

Keep the hosts here in sync with the `applinks:` entry in `ios/Runner/Runner.entitlements` and the
`android:host` in the Android App Links `intent-filter` (`AndroidManifest.xml`). Add one entry per
domain the app should claim (e.g. a production `app.mercadoahorros.net`).

## Content type note

Apple fetches the AASA (no file extension) through its CDN and is tolerant of the content type, but
`application/json` is recommended. If verification is flaky, force it in `next.config` via a
`headers()` rule for `/.well-known/apple-app-site-association`.
