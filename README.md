# IRIS Market

IRIS Market is the public, source-available catalogue for IRIS plugins. The
market site, catalogue and every published package live here instead of the
private IRIS Core repository.

## Install a package

1. Download or clone this repository.
2. In IRIS, open **Plugins** and choose **Install from folder**.
3. Select the plugin directory, for example `plugins/tibo-will-reset`.

IRIS validates the package manifest before installing it under the local user
plugin directory. Review a plugin's declared permissions before installing it.

## Tibo will reset?

This M-level monitor reads a configured public feed for `@thsottiaux`. When
IRIS recognizes an active ChatGPT subscription, it can publish an important
notification and make a short, capped correction to automatic Load estimation.
It never changes an account's displayed quota, selection or billing state.

The default public syndication endpoint can rate-limit unauthenticated clients.
When that happens, IRIS records the monitor failure and makes no reset
inference. The package is therefore published as a preview, not as an
authoritative quota monitor.

## Development

```sh
npm run verify
npm test
npx wrangler pages dev site
```

The repository contains no credentials or private IRIS services.
`site/market.json` is the catalogue consumed by the static market page and is
checked against each package manifest by `npm run verify`.
