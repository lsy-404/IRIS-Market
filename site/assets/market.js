const marketEl = document.querySelector('#market');
const repository = 'https://github.com/wuyilingwei/IRIS-Market';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
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

function card(plugin) {
  const article = element('article', 'plugin');
  const header = element('div', 'plugin-header');
  header.append(element('h3', '', plugin.name), element('span', 'version', `v${plugin.version}`));
  article.append(header, element('p', 'summary', plugin.summary));
  const tags = element('div', 'meta');
  [plugin.category, ...plugin.targets, plugin.license, plugin.status].forEach((value) => tags.append(element('span', `tag ${value === 'preview' ? 'preview' : ''}`, value)));
  article.append(tags, element('p', 'disclosure', plugin.disclosure));
  const details = element('div', 'details');
  details.append(list('REQUIREMENTS', plugin.requirements), list('DECLARED PERMISSIONS', plugin.permissions));
  article.append(details);
  const actions = element('div', 'actions');
  const packageLink = element('a', 'button', 'View package');
  packageLink.href = `${repository}/tree/main/${plugin.source.path}`;
  const sourceLink = element('a', 'button secondary', 'View manifest');
  sourceLink.href = `${repository}/blob/main/${plugin.source.path}/plugin.json`;
  actions.append(packageLink, sourceLink);
  article.append(actions);
  return article;
}

try {
  const response = await fetch('../market.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);
  const market = await response.json();
  if (!Array.isArray(market.plugins)) throw new Error('Catalogue has no plugin list');
  marketEl.replaceChildren(...market.plugins.map(card));
} catch {
  marketEl.replaceChildren(element('p', 'loading', 'The market catalogue is temporarily unavailable. You can still inspect the public repository.'));
}

