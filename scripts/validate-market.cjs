const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const market = JSON.parse(fs.readFileSync(path.join(root, 'site', 'market.json'), 'utf8'));
assert.equal(market.schemaVersion, 1, 'market schemaVersion must be 1');
assert.equal(market.name, 'IRIS Market', 'market name must be IRIS Market');
assert.ok(Array.isArray(market.plugins) && market.plugins.length > 0, 'market needs a plugin');

const ids = new Set();
for (const entry of market.plugins) {
  assert.match(entry.id, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'invalid plugin id');
  assert.ok(!ids.has(entry.id), `duplicate plugin id: ${entry.id}`);
  ids.add(entry.id);
  assert.equal(entry.source?.type, 'repository', `${entry.id} must be a repository package`);
  assert.equal(typeof entry.source?.path, 'string', `${entry.id} needs a package path`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, entry.source.path, 'plugin.json'), 'utf8'));
  assert.equal(manifest.id, entry.id, `${entry.id} manifest id must match market entry`);
  assert.equal(manifest.version, entry.version, `${entry.id} manifest version must match market entry`);
  assert.equal(manifest.manifestVersion, 2, `${entry.id} must use the runtime manifest`);
  assert.ok(fs.existsSync(path.join(root, entry.source.path, manifest.runtime.entry)), `${entry.id} runtime entry is missing`);
}

console.log(`Validated ${market.plugins.length} market plugin(s).`);
