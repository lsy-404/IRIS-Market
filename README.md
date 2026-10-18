# IRIS Market

IRIS Market is the public, source-available catalogue for IRIS plugins. The
market site, catalogue and every published package live here instead of the
private IRIS Core repository. The site is published at
`https://iris-market.pages.dev`.

## Install a plugin

In IRIS, open **Plugins**, switch to **Market**, review the plugin's
permissions and disclosure, and install it. IRIS downloads the package,
checks its size and SHA-256 against the catalogue and checks that its manifest
requests exactly the listed permissions. Enable the plugin separately once its
settings are filled in.

## Plugins

- [Message Center](plugins/message-center/README.md) lets IRIS agents read and
  answer QQ messages relayed by your own Message Center, and answers direct
  messages while you are away.
- [Tibo will reset?](plugins/tibo-will-reset/README.md) reads a configured
  public feed for `@thsottiaux`. When IRIS recognizes an active ChatGPT
  subscription, it can publish an important notification and make a short,
  capped correction to automatic Load estimation. It never changes an
  account's displayed quota, selection or billing state. The default public
  syndication endpoint can rate-limit unauthenticated clients; IRIS then
  records the monitor failure and makes no reset inference, so the package is
  published as a preview.

## Catalogue

`site/market.json` is served as `https://iris-market.pages.dev/market.json`.
IRIS accepts only `schemaVersion` 2:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `version` | Equal to the package's `plugin.json`. |
| `summary`, `category`, `license`, `requirements`, `disclosure` | Shown before installation. |
| `status` | `stable` or `preview`. |
| `targets` | The manifest's `runtime.agents`: `management` and/or `execution`. |
| `permissions` | The manifest's `runtime.permissions`, as a set. |
| `permissionsDetail` | `{ "<permission>": "reason" }` with one key per permission: why this plugin needs it. |
| `network` | A copy of the manifest's `runtime.network`, when declared. |
| `mcp` | `{ tools }` from the manifest's `runtime.mcp`, when declared. The address, path and credential settings stay in the manifest. |
| `package` | `{ url, sha256, size, format: "zip" }`; `url` is `https://iris-market.pages.dev/packages/<id>-<version>.zip`. |
| `commit` | The commit the package was built from. |
| `publishedAt` | When this package content was first packed (ISO 8601, UTC). |

`site/plugin-permissions.json` is the permission vocabulary, with each
permission's risk, label and description. It mirrors
`electron/src/shared/plugin-permissions.ts` and the `pluginPermission` English
strings in IRIS Core and changes only together with them.

## Publish a change

1. Edit the plugin under `plugins/<id>/`, bump its `version` in `plugin.json`
   and in `site/market.json`, and commit the plugin directory.
2. Run `pnpm run pack`. It zips each plugin's files as committed (not the
   checked-out copies, so line-ending conversion never changes a package) into
   `site/packages/`, fills in `package`, `commit` and `publishedAt`, and removes
   packages no entry refers to. A changed package whose version was not bumped
   is refused.
3. Run `pnpm run verify` and commit the catalogue and packages.

`pnpm run verify` checks each entry against its manifest (permissions, targets,
`network`, `mcp` tools), the permission vocabulary, the package hash and size, that
the package matches a fresh build of the plugin, IRIS's size limits (package
at most 5 MB, at most 200 entries and 20 MB unpacked) and that the plugin directory
is unchanged since `commit`.

```sh
pnpm install
pnpm run pack
pnpm run verify
pnpm dlx wrangler pages dev site
```

The repository contains no credentials or private IRIS services.
