const marketEl = document.querySelector('#market');
const repository = 'https://github.com/lsy-404/IRIS-Market';
const RISK_ORDER = { high: 0, medium: 1, low: 2 };
const TARGET_LABELS = { management: 'Management agent', execution: 'Execution agent' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(className, text, href) {
  const node = element('a', className, text);
  node.href = href;
  return node;
}

function list(title, values) {
  const block = element('div');
  block.append(element('h4', '', title));
  const items = element('ul');
  values.forEach((value) => items.append(element('li', '', value)));
  block.append(items);
  return block;
}

function remoteTargets(plugin) {
  const rows = (plugin.network?.origins ?? []).map((origin) => `Reads ${origin} without credentials`);
  if (plugin.mcp) rows.push(`IRIS calls ${plugin.mcp.tools.join(', ')} at the address you set, path ${plugin.mcp.path}`);
  return rows.length ? rows : ['None'];
}

function permissions(plugin, vocabulary) {
  const block = element('div', 'permissions');
  block.append(element('h4', '', 'PERMISSIONS'));
  const reasons = new Map(plugin.permissionsDetail.map((detail) => [detail.id, detail.reason]));
  const items = element('ul');
  plugin.permissions
    .map((id) => vocabulary.get(id) ?? { id, risk: 'high', label: id, description: 'Not in the published permission list.' })
    .sort((left, right) => RISK_ORDER[left.risk] - RISK_ORDER[right.risk])
    .forEach((info) => {
      const item = element('li', 'permission');
      const head = element('div', 'permission-head');
      head.append(element('span', `risk ${info.risk}`, info.risk), element('strong', '', info.label), element('code', '', info.id));
      item.append(head, element('p', '', info.description));
      if (reasons.has(info.id)) item.append(element('p', 'reason', reasons.get(info.id)));
      items.append(item);
    });
  block.append(items);
  return block;
}

function card(plugin, vocabulary) {
  const article = element('article', 'plugin');
  const header = element('div', 'plugin-header');
  header.append(element('h3', '', plugin.name), element('span', 'version', `v${plugin.version}`));
  article.append(header, element('p', 'summary', plugin.summary));
  const tags = element('div', 'meta');
  [plugin.category, ...plugin.targets.map((target) => TARGET_LABELS[target] ?? target), plugin.license, plugin.status]
    .forEach((value) => tags.append(element('span', `tag ${value === 'preview' ? 'preview' : ''}`, value)));
  const disclosure = element('div', 'disclosure');
  disclosure.append(element('h4', '', 'DISCLOSURE'), element('p', '', plugin.disclosure));
  const details = element('div', 'details');
  details.append(list('REQUIREMENTS', plugin.requirements), list('REMOTE TARGETS', remoteTargets(plugin)));
  article.append(tags, disclosure, details, permissions(plugin, vocabulary));
  const source = `plugins/${plugin.id}`;
  const actions = element('div', 'actions');
  actions.append(
    link('button', 'Download package', new URL(plugin.package.url).pathname),
    link('button secondary', 'View source', `${repository}/tree/${plugin.commit}/${source}`),
    link('button secondary', 'View manifest', `${repository}/blob/${plugin.commit}/${source}/plugin.json`),
  );
  const published = new Date(plugin.publishedAt).toISOString().slice(0, 10);
  article.append(actions, element('p', 'package', `Published ${published} · ${plugin.package.size} bytes · SHA-256 ${plugin.package.sha256}`));
  return article;
}

async function json(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} request failed: ${response.status}`);
  return response.json();
}

try {
  const [market, vocabulary] = await Promise.all([json('./market.json'), json('./plugin-permissions.json')]);
  if (!Array.isArray(market.plugins)) throw new Error('Catalogue has no plugin list');
  const permissionsById = new Map(vocabulary.permissions.map((item) => [item.id, item]));
  marketEl.replaceChildren(...market.plugins.map((plugin) => card(plugin, permissionsById)));
} catch {
  marketEl.replaceChildren(element('p', 'loading', 'The market catalogue is temporarily unavailable. You can still inspect the public repository.'));
}
