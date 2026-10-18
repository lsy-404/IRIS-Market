const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { zipSync } = require('fflate');

const root = path.resolve(__dirname, '..');
const marketFile = path.join(root, 'site', 'market.json');
const packagesDir = path.join(root, 'site', 'packages');
const PACKAGE_ORIGIN = 'https://iris-market.pages.dev';
// Local midnight gives the same DOS timestamp in every time zone.
const MTIME = new Date(2020, 0, 1);

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function pluginPath(id) {
  return `plugins/${id}`;
}

function packageName(entry) {
  return `${entry.id}-${entry.version}.zip`;
}

function packageUrl(entry) {
  return `${PACKAGE_ORIGIN}/packages/${packageName(entry)}`;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** The plugin's tracked files, zipped byte-for-byte reproducibly with plugin.json at the root. */
function buildPackage(id) {
  const prefix = `${pluginPath(id)}/`;
  const tracked = git(['ls-files', '-z', '--', pluginPath(id)]).split('\0').filter(Boolean);
  if (!tracked.includes(`${prefix}plugin.json`)) throw new Error(`${pluginPath(id)}/plugin.json is not tracked`);
  const files = {};
  for (const file of tracked.sort()) {
    const absolute = path.join(root, file);
    if (!fs.lstatSync(absolute).isFile()) throw new Error(`${file} is not a regular file`);
    files[file.slice(prefix.length)] = [fs.readFileSync(absolute), { mtime: MTIME }];
  }
  return Buffer.from(zipSync(files, { level: 9 }));
}

function main() {
  const market = JSON.parse(fs.readFileSync(marketFile, 'utf8'));
  fs.mkdirSync(packagesDir, { recursive: true });
  const kept = new Set();
  for (const entry of market.plugins) {
    if (git(['status', '--porcelain', '--', pluginPath(entry.id)])) {
      throw new Error(`commit ${pluginPath(entry.id)} before packing it`);
    }
    const bytes = buildPackage(entry.id);
    const digest = sha256(bytes);
    const url = packageUrl(entry);
    const previous = entry.package ?? {};
    if (previous.url === url && previous.sha256 && previous.sha256 !== digest) {
      throw new Error(`${entry.id} ${entry.version} is already published with other content; bump its version`);
    }
    fs.writeFileSync(path.join(packagesDir, packageName(entry)), bytes);
    kept.add(packageName(entry));
    entry.commit = git(['log', '-1', '--format=%H', '--', pluginPath(entry.id)]);
    if (previous.sha256 !== digest) entry.publishedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    entry.package = { url, sha256: digest, size: bytes.length, format: 'zip' };
  }
  for (const name of fs.readdirSync(packagesDir)) if (!kept.has(name)) fs.rmSync(path.join(packagesDir, name));
  fs.writeFileSync(marketFile, `${JSON.stringify(market, null, 2)}\n`);
  console.log(`Packed ${kept.size} plugin(s).`);
}

module.exports = { buildPackage, git, packageName, packageUrl, packagesDir, pluginPath, sha256 };

if (require.main === module) main();
