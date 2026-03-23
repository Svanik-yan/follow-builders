// Combined feed API — merges X tweets + podcasts into one response
const FEED_X_URL = 'https://raw.githubusercontent.com/Svanik-yan/follow-builders/main/feed-x.json';
const FEED_PODCASTS_URL = 'https://raw.githubusercontent.com/Svanik-yan/follow-builders/main/feed-podcasts.json';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const [xRes, podcastRes] = await Promise.all([
      fetch(FEED_X_URL),
      fetch(FEED_PODCASTS_URL)
    ]);

    const feedX = xRes.ok ? await xRes.json() : { x: [], stats: {} };
    const feedPodcasts = podcastRes.ok ? await podcastRes.json() : { podcasts: [], stats: {} };

    const combined = {
      generatedAt: feedX.generatedAt || feedPodcasts.generatedAt || null,
      stats: {
        xBuilders: feedX.x?.length || 0,
        totalTweets: (feedX.x || []).reduce((s, a) => s + a.tweets.length, 0),
        podcastEpisodes: feedPodcasts.podcasts?.length || 0
      },
      x: feedX.x || [],
      podcasts: feedPodcasts.podcasts || []
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(combined);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
