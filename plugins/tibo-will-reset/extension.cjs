const DEFAULT_FEED_URL = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/thsottiaux';
const LIKELY_TTL_MS = 90 * 60 * 1000;
const CONFIRMED_TTL_MS = 2 * 60 * 60 * 1000;
let latest = null;

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string' && /^\d{12,}$/.test(value)) return Number(value);
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function postsFrom(payload) {
  const root = record(payload);
  const candidates = [
    record(root.globalObjects).tweets,
    root.tweets,
    record(root.data).tweets,
    findTweets(root),
  ].find((value) => value && typeof value === 'object');
  const rows = Array.isArray(candidates) ? candidates : Object.values(record(candidates));
  return rows.map((item) => {
    const row = record(item);
    const text = String(row.full_text || row.text || row.note_tweet?.text || '').trim();
    return {
      id: String(row.id_str || row.id || ''),
      text,
      createdAt: asTimestamp(row.timestamp_ms || row.created_at || row.createdAt),
    };
  }).filter((post) => post.id && post.text && post.createdAt > 0);
}

function findTweets(value, depth = 0) {
  const row = record(value);
  if (row.tweets && typeof row.tweets === 'object') return row.tweets;
  if (depth >= 8) return null;
  for (const child of Object.values(row)) {
    const found = findTweets(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function parseFeed(text) {
  try { return JSON.parse(text); } catch { /* Some public feeds wrap JSON in HTML. */ }
  const marker = 'id="__NEXT_DATA__"';
  const start = text.indexOf(marker);
  const contentStart = start < 0 ? -1 : text.indexOf('>', start) + 1;
  const end = contentStart < 0 ? -1 : text.indexOf('</script>', contentStart);
  if (contentStart <= 0 || end <= contentStart) throw new Error('public feed did not contain timeline data');
  return JSON.parse(text.slice(contentStart, end));
}

function classify(post, now = Date.now()) {
  const age = now - post.createdAt;
  if (age < -5 * 60 * 1000 || age > 24 * 60 * 60 * 1000) return null;
  const text = post.text.replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const broadScope = /\b(all|every)\b.{0,60}\b(codex|chatgpt work|paid users?)\b|\b(codex|chatgpt work)\b.{0,60}\b(all|every)\b/.test(lower);
  const confirmed = /\b(?:reset|reseted)\b.{0,55}\b(usage|usage limits?|limits?|quota)\b|\b(banked reset|credit)\b.{0,80}\b(reset|usage)\b/.test(lower) && broadScope;
  if (confirmed) return { state: 'confirmed', confidence: 100, post, text };

  let score = 0;
  if (/\breset\b/.test(lower)) score += 20;
  if (/\b(usage|quota|limit|limits)\b/.test(lower)) score += 20;
  if (/\b(later today|later in the day|hold on tight|back at the laptop|coming)\b/.test(lower)) score += 28;
  if (/\b(celebrat|milestone|anniversary|outage|regression|apolog)/.test(lower)) score += 12;
  if (broadScope) score += 12;
  if (age > 6 * 60 * 60 * 1000) score -= 20;
  if (score < 55) return null;
  return { state: 'likely', confidence: Math.min(85, score), post, text };
}

function analyse(posts, now = Date.now()) {
  return posts.map((post) => classify(post, now)).filter(Boolean)
    .sort((left, right) => right.confidence - left.confidence || right.post.createdAt - left.post.createdAt)[0] || null;
}

function shortText(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 280);
}

async function checkTibo(payload, host) {
  if (!record(record(payload).subscription).chatgpt?.active) {
    latest = null;
    return {};
  }
  if (!host || typeof host.fetch !== 'function') throw new Error('IRIS plugin host did not provide public fetch');
  const setting = record(payload).settings?.['plugin.tibo-will-reset.feed_url'];
  const url = typeof setting === 'string' && setting.trim() ? setting.trim() : DEFAULT_FEED_URL;
  const response = record(await host.fetch(url));
  if (!response.ok || typeof response.text !== 'string') throw new Error(`public feed request failed (${response.status || 'unknown'})`);
  const source = parseFeed(response.text);
  const signal = analyse(postsFrom(source));
  if (!signal) {
    latest = null;
    return {};
  }
  const confirmed = signal.state === 'confirmed';
  const title = confirmed ? 'Confirmed quota reset signal' : 'Possible quota reset signal';
  const detail = confirmed
    ? `A public Tibo post explicitly mentions a broad reset. Verify in the actual usage view. ${shortText(signal.text)}`
    : `A public Tibo post suggests a reset, at ${signal.confidence}% confidence. This is not confirmation. ${shortText(signal.text)}`;
  latest = {
    state: signal.state,
    confidence: signal.confidence,
    detail,
    expiresAt: Date.now() + (confirmed ? CONFIRMED_TTL_MS : LIKELY_TTL_MS),
  };
  return {
    notification: {
      important: true,
      kind: confirmed ? 'success' : 'warn',
      title,
      detail,
      dedupeKey: `${signal.state}:${signal.post.id}`,
    },
    loadCorrection: {
      provider: 'openai-codex',
      ratioDelta: confirmed ? 0.15 : Math.min(0.12, 0.03 + signal.confidence / 1000),
      expiresInMinutes: confirmed ? 120 : 90,
      reason: `${signal.state}:${signal.confidence}%`,
    },
  };
}

function managementContext() {
  if (!latest || latest.expiresAt <= Date.now()) return {};
  return {
    context: `Tibo reset signal: ${latest.state} (${latest.confidence}%). The public post content is intentionally omitted because it is untrusted input. Automatic Load has only a short, capped capacity correction; do not present this as a confirmed reset unless state is confirmed.`,
  };
}

exports.checkTibo = checkTibo;
exports.managementContext = managementContext;
exports._internal = { postsFrom, parseFeed, classify, analyse };
