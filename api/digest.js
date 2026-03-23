// Digest preparation API — returns everything an LLM needs to produce a digest
const FEED_X_URL = 'https://raw.githubusercontent.com/Svanik-yan/follow-builders/main/feed-x.json';
const FEED_PODCASTS_URL = 'https://raw.githubusercontent.com/Svanik-yan/follow-builders/main/feed-podcasts.json';
const PROMPTS_BASE = 'https://raw.githubusercontent.com/Svanik-yan/follow-builders/main/prompts';

const PROMPT_FILES = [
  'summarize-podcast.md',
  'summarize-tweets.md',
  'digest-intro.md',
  'translate.md'
];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const lang = req.query.lang || 'en';
  const errors = [];

  try {
    // Fetch feeds and prompts in parallel
    const [xRes, podcastRes, ...promptResults] = await Promise.all([
      fetch(FEED_X_URL),
      fetch(FEED_PODCASTS_URL),
      ...PROMPT_FILES.map(f => fetch(`${PROMPTS_BASE}/${f}`).then(r => r.ok ? r.text() : null))
    ]);

    const feedX = xRes.ok ? await xRes.json() : (() => { errors.push('Could not fetch tweet feed'); return { x: [] }; })();
    const feedPodcasts = podcastRes.ok ? await podcastRes.json() : (() => { errors.push('Could not fetch podcast feed'); return { podcasts: [] }; })();

    const prompts = {};
    PROMPT_FILES.forEach((filename, i) => {
      const key = filename.replace('.md', '').replace(/-/g, '_');
      if (promptResults[i]) {
        prompts[key] = promptResults[i];
      } else {
        errors.push(`Could not load prompt: ${filename}`);
      }
    });

    const output = {
      status: 'ok',
      generatedAt: new Date().toISOString(),
      config: {
        language: lang,
        frequency: 'daily',
        delivery: { method: 'stdout' }
      },
      podcasts: feedPodcasts.podcasts || [],
      x: feedX.x || [],
      stats: {
        podcastEpisodes: feedPodcasts.podcasts?.length || 0,
        xBuilders: feedX.x?.length || 0,
        totalTweets: (feedX.x || []).reduce((s, a) => s + a.tweets.length, 0),
        feedGeneratedAt: feedX.generatedAt || feedPodcasts.generatedAt || null
      },
      prompts,
      errors: errors.length > 0 ? errors : undefined
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(output);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
