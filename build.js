import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const PUBLIC = 'public';

async function build() {
  // Ensure public dir exists
  if (!existsSync(PUBLIC)) await mkdir(PUBLIC, { recursive: true });

  // Copy feed JSON files to public for static serving
  const feeds = ['feed-x.json', 'feed-podcasts.json'];
  for (const f of feeds) {
    if (existsSync(f)) {
      await copyFile(f, join(PUBLIC, f));
    }
  }

  // Read feed data for embedding into the page
  let feedX = { x: [], stats: {} };
  let feedPodcasts = { podcasts: [], stats: {} };
  try {
    feedX = JSON.parse(await readFile('feed-x.json', 'utf-8'));
  } catch {}
  try {
    feedPodcasts = JSON.parse(await readFile('feed-podcasts.json', 'utf-8'));
  } catch {}

  const sources = JSON.parse(await readFile('config/default-sources.json', 'utf-8'));
  const builderCount = sources.x_accounts.length;
  const podcastCount = sources.podcasts.length;
  const tweetCount = (feedX.x || []).reduce((s, a) => s + a.tweets.length, 0);
  const generatedAt = feedX.generatedAt || new Date().toISOString();

  // Build index.html
  const html = buildHTML({
    feedX, feedPodcasts, builderCount, podcastCount, tweetCount, generatedAt
  });
  await writeFile(join(PUBLIC, 'index.html'), html);

  console.log(`Build complete: ${builderCount} builders, ${podcastCount} podcasts, ${tweetCount} tweets`);
}

function buildHTML({ feedX, feedPodcasts, builderCount, podcastCount, tweetCount, generatedAt }) {
  const xItems = (feedX.x || []).map(builder => {
    const tweets = builder.tweets.map(t => {
      const text = escapeHTML(t.text.length > 280 ? t.text.slice(0, 280) + '...' : t.text);
      return `<div class="tweet">
        <p>${text}</p>
        <div class="tweet-meta">
          <span>${t.likes || 0} likes</span>
          <a href="${escapeHTML(t.url)}" target="_blank" rel="noopener">View on X</a>
        </div>
      </div>`;
    }).join('');

    const bio = builder.bio ? `<p class="bio">${escapeHTML(builder.bio.slice(0, 160))}</p>` : '';

    return `<div class="builder-card">
      <div class="builder-header">
        <h3>${escapeHTML(builder.name)}</h3>
        <a href="https://x.com/${escapeHTML(builder.handle)}" target="_blank" rel="noopener" class="handle">${escapeHTML(builder.handle)}</a>
      </div>
      ${bio}
      ${tweets}
    </div>`;
  }).join('');

  const podcastItems = (feedPodcasts.podcasts || []).map(ep => {
    const transcript = ep.transcript
      ? escapeHTML(ep.transcript.slice(0, 500)) + '...'
      : 'No transcript available';
    return `<div class="podcast-card">
      <h3><a href="${escapeHTML(ep.url)}" target="_blank" rel="noopener">${escapeHTML(ep.title)}</a></h3>
      <p class="podcast-source">${escapeHTML(ep.name)}</p>
      <details><summary>Transcript preview</summary><p class="transcript">${transcript}</p></details>
    </div>`;
  }).join('') || '<p class="empty">No new episodes today.</p>';

  const dateStr = new Date(generatedAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Follow Builders — AI Builders Digest</title>
  <meta name="description" content="Daily digest from ${builderCount} top AI builders and ${podcastCount} podcasts. Follow builders, not influencers.">
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --border: #262626;
      --text: #e5e5e5;
      --text-secondary: #a3a3a3;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; }

    /* Hero */
    .hero { text-align: center; padding: 3rem 0 2rem; }
    .hero h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
    .hero .tagline { color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 1.5rem; }
    .stats {
      display: flex; justify-content: center; gap: 2rem;
      flex-wrap: wrap; margin-bottom: 1rem;
    }
    .stat { text-align: center; }
    .stat .num { font-size: 1.5rem; font-weight: 700; color: var(--accent); }
    .stat .label { font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
    .updated { color: var(--text-secondary); font-size: 0.85rem; }

    /* Sections */
    .section { margin-top: 2.5rem; }
    .section > h2 {
      font-size: 1.2rem; font-weight: 600;
      padding-bottom: 0.75rem; margin-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    /* Cards */
    .builder-card, .podcast-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .builder-header { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; }
    .builder-header h3 { font-size: 1rem; font-weight: 600; }
    .handle { color: var(--text-secondary); font-size: 0.85rem; text-decoration: none; }
    .handle:hover { color: var(--accent); }
    .bio { color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.75rem; }

    .tweet {
      padding: 0.75rem 0;
      border-top: 1px solid var(--border);
    }
    .tweet:first-of-type { border-top: none; padding-top: 0.25rem; }
    .tweet p { font-size: 0.95rem; margin-bottom: 0.5rem; white-space: pre-wrap; }
    .tweet-meta {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.8rem; color: var(--text-secondary);
    }
    .tweet-meta a { color: var(--accent); text-decoration: none; }
    .tweet-meta a:hover { color: var(--accent-hover); }

    .podcast-card h3 { font-size: 1rem; margin-bottom: 0.25rem; }
    .podcast-card h3 a { color: var(--accent); text-decoration: none; }
    .podcast-card h3 a:hover { text-decoration: underline; }
    .podcast-source { color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem; }
    details summary { cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; }
    .transcript { color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem; white-space: pre-wrap; }

    .empty { color: var(--text-secondary); font-style: italic; }

    /* API section */
    .api-section {
      margin-top: 3rem; padding-top: 2rem;
      border-top: 1px solid var(--border);
      text-align: center;
    }
    .api-section h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .api-links { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .api-link {
      display: inline-block; padding: 0.5rem 1rem;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; color: var(--accent);
      text-decoration: none; font-family: monospace; font-size: 0.85rem;
    }
    .api-link:hover { border-color: var(--accent); }

    /* Footer */
    footer {
      margin-top: 3rem; padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      text-align: center; color: var(--text-secondary); font-size: 0.8rem;
    }
    footer a { color: var(--text-secondary); }

    @media (max-width: 600px) {
      .container { padding: 1rem; }
      .hero h1 { font-size: 1.5rem; }
      .stats { gap: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>Follow Builders, Not Influencers</h1>
      <p class="tagline">AI builders digest — curated daily from the people actually building the future</p>
      <div class="stats">
        <div class="stat"><div class="num">${builderCount}</div><div class="label">Builders</div></div>
        <div class="stat"><div class="num">${podcastCount}</div><div class="label">Podcasts</div></div>
        <div class="stat"><div class="num">${tweetCount}</div><div class="label">Tweets Today</div></div>
      </div>
      <p class="updated">Last updated: ${dateStr}</p>
    </div>

    <div class="section">
      <h2>X / Twitter</h2>
      ${xItems || '<p class="empty">No new tweets today.</p>'}
    </div>

    <div class="section">
      <h2>Podcasts</h2>
      ${podcastItems}
    </div>

    <div class="api-section">
      <h2>API Endpoints</h2>
      <div class="api-links">
        <a class="api-link" href="/feed-x.json">GET /feed-x.json</a>
        <a class="api-link" href="/feed-podcasts.json">GET /feed-podcasts.json</a>
        <a class="api-link" href="/api/feed">GET /api/feed</a>
        <a class="api-link" href="/api/digest">GET /api/digest</a>
      </div>
    </div>

    <footer>
      <p>
        <a href="https://github.com/Svanik-yan/follow-builders" target="_blank">GitHub</a>
        &middot; Follow builders with original opinions, not influencers who regurgitate.
      </p>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
