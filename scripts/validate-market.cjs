const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPackage, git, packageName, packageUrl, packagesDir, pluginPath, sha256 } = require('./pack-market.cjs');

const root = path.resolve(__dirname, '..');
const PLUGIN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const RISKS = new Set(['low', 'medium', 'high']);
const TARGETS = new Set(['management', 'execution']);
const STATUSES = new Set(['stable', 'preview']);
const ENTRY_FIELDS = new Set([
  'id', 'name', 'version', 'summary', 'category', 'targets', 'status', 'license', 'commit', 'publishedAt',
  'package', 'requirements', 'permissions', 'permissionsDetail', 'network', 'mcp', 'disclosure',
]);

function read(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertSet(actual, expected, message) {
  assert.ok(Array.isArray(actual) && Array.isArray(expected), message);
  assert.equal(new Set(actual).size, actual.length, `${message} (duplicate)`);
  assert.deepEqual([...actual].sort(), [...new Set(expected)].sort(), message);
}

const vocabulary = new Map();
for (const item of read('site/plugin-permissions.json').permissions) {
  assert.match(item.id, /^[a-z]+:[a-z]+$/, `invalid permission id: ${item.id}`);
  assert.ok(!vocabulary.has(item.id), `duplicate permission: ${item.id}`);
  assert.ok(RISKS.has(item.risk), `${item.id} needs a low, medium or high risk`);
  assert.ok(text(item.label) && text(item.description), `${item.id} needs a label and a description`);
  vocabulary.set(item.id, item);
}

const market = read('site/market.json');
assert.equal(market.schemaVersion, 2, 'market schemaVersion must be 2');
assert.equal(market.name, 'IRIS Market', 'market name must be IRIS Market');
assert.ok(Array.isArray(market.plugins) && market.plugins.length > 0, 'market needs a plugin');

const ids = new Set();
const packages = new Set();
for (const entry of market.plugins) {
  assert.match(String(entry.id), PLUGIN_ID_RE, `invalid plugin id: ${entry.id}`);
  const id = entry.id;
  assert.ok(!ids.has(id), `duplicate plugin id: ${id}`);
  ids.add(id);
  for (const field of Object.keys(entry)) assert.ok(ENTRY_FIELDS.has(field), `${id} has unknown field ${field}`);
  for (const field of ['name', 'version', 'summary', 'category', 'license', 'disclosure']) assert.ok(text(entry[field]), `${id} needs ${field}`);
  assert.ok(STATUSES.has(entry.status), `${id} status must be stable or preview`);
  assert.ok(Array.isArray(entry.requirements) && entry.requirements.every(text), `${id} requirements must be text`);

  const manifest = read(`${pluginPath(id)}/plugin.json`);
  const runtime = manifest.runtime ?? {};
  assert.equal(manifest.manifestVersion, 2, `${id} must use the runtime manifest`);
  assert.equal(manifest.id, id, `${id} manifest id must match market entry`);
  assert.equal(manifest.name, entry.name, `${id} manifest name must match market entry`);
  assert.equal(manifest.version, entry.version, `${id} manifest version must match market entry`);
  assert.ok(fs.existsSync(path.join(root, pluginPath(id), String(runtime.entry))), `${id} runtime entry is missing`);
  for (const permission of runtime.permissions ?? []) assert.ok(vocabulary.has(permission), `${id} requests unknown permission ${permission}`);
  assertSet(entry.permissions, runtime.permissions ?? [], `${id} permissions must equal the manifest's`);
  const details = entry.permissionsDetail;
  assert.ok(details && typeof details === 'object' && !Array.isArray(details), `${id} permissionsDetail must map each permission to a reason`);
  assertSet(Object.keys(details), entry.permissions, `${id} permissionsDetail must explain each permission`);
  for (const [permission, reason] of Object.entries(details)) assert.ok(text(reason), `${id} ${permission} needs a reason`);
  assert.ok(Array.isArray(entry.targets) && entry.targets.every((target) => TARGETS.has(target)), `${id} targets must be management or execution`);
  assertSet(entry.targets, runtime.agents ?? [], `${id} targets must equal the manifest's agents`);
  assert.deepEqual(entry.network, runtime.network, `${id} network must equal the manifest's`);
  if (runtime.mcp) {
    assert.deepEqual(Object.keys(entry.mcp ?? {}), ['tools'], `${id} mcp lists only tools`);
    assert.deepEqual(entry.mcp.tools, runtime.mcp.tools, `${id} mcp tools must equal the manifest's`);
  } else {
    assert.equal(entry.mcp, undefined, `${id} declares no MCP server`);
  }

  assert.match(String(entry.commit), /^[0-9a-f]{40}$/, `${id} commit must be a full commit hash`);
  assert.equal(git(['cat-file', '-t', entry.commit]), 'commit', `${id} commit is unknown`);
  assert.equal(git(['diff', '--name-only', entry.commit, '--', pluginPath(id)]), '', `${id} differs from its commit; run pnpm run pack`);
  assert.match(String(entry.publishedAt), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `${id} publishedAt must be an ISO 8601 UTC time`);
  assert.ok(Number.isFinite(Date.parse(entry.publishedAt)), `${id} publishedAt is not a date`);

  const pkg = entry.package ?? {};
  assert.deepEqual(Object.keys(pkg).sort(), ['format', 'sha256', 'size', 'url'], `${id} package is {url, sha256, size, format}`);
  assert.equal(pkg.format, 'zip', `${id} package format must be zip`);
  assert.equal(pkg.url, packageUrl(entry), `${id} package url must be ${packageUrl(entry)}`);
  const file = path.join(packagesDir, packageName(entry));
  assert.ok(fs.existsSync(file), `${id} package is missing; run pnpm run pack`);
  const bytes = fs.readFileSync(file);
  assert.equal(pkg.size, bytes.length, `${id} package size does not match the file`);
  assert.equal(pkg.sha256, sha256(bytes), `${id} package sha256 does not match the file`);
  assert.ok(bytes.equals(buildPackage(id, entry.commit)), `${id} package is stale; run pnpm run pack`);
  packages.add(packageName(entry));
}

const stray = fs.readdirSync(packagesDir).filter((name) => !packages.has(name));
assert.deepEqual(stray, [], `site/packages has files no entry publishes: ${stray.join(', ')}`);

console.log(`Validated ${market.plugins.length} market plugin(s) and ${vocabulary.size} permissions.`);
