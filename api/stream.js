// Vercel Serverless Function: Stream Resolver
const DEFAULT_TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://open.demonii.com:1337/announce",
  "udp://open.tracker.cl:1337/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.bittor.pw:1337/announce",
  "udp://tracker-udp.gbitt.info:80/announce",
  "udp://explodie.org:6969/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://opentor.net:6969",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.btorrent.xyz",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce"
];

export default async function handler(req, res) {
  // CORS & Cache Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { type = 'movie', id } = req.query;

  // Strict Parameter Validation
  if (!['movie', 'series'].includes(type) || !id || !/^tt\d+(:\d+:\d+)?$/.test(id)) {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    const providerUrl = `https://torrentio.strem.fun/stream/${type}/${encodeURIComponent(id)}.json`;
    const response = await fetch(providerUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return res.status(200).json({ streams: [] });
    }

    const data = await response.json();
    const rawStreams = data.streams || [];

    // Precise Regex Patterns (Word boundaries avoid false positives on 'Cameron', 'Atlas', etc.)
    const spanishRegex = /\b(lat|latino|castellano|dual|esp)\b|cinecalidad|wolfmax4k|[🇪🇸🇲🇽]/i;
    const lowQualityRegex = /\b(cam|telesync|tele-sync|hdcam|camrip|predvd)\b/i;

    // Filter and score streams
    const scored = rawStreams
      .filter(s => {
        const text = ((s.title || '') + ' ' + (s.name || '')).toLowerCase();
        return !lowQualityRegex.test(text);
      })
      .map(s => {
        const text = ((s.title || '') + ' ' + (s.name || '')).toLowerCase();
        const isSpanish = spanishRegex.test(text);

        // Extract seeds count
        const seedsMatch = (s.title || '').match(/👤\s*(\d+)/);
        const seeds = seedsMatch ? parseInt(seedsMatch[1], 10) : 0;

        let score = seeds;
        if (isSpanish) score += 5000;

        let quality = '1080p';
        if (/\b(2160p|4k|uhd)\b/i.test(text)) quality = '4K UHD';
        else if (/\b720p\b/i.test(text)) quality = '720p HD';
        else if (/\b1080p\b/i.test(text)) quality = '1080p FHD';

        return { s, isSpanish, seeds, score, quality };
      });

    scored.sort((a, b) => b.score - a.score);

    // Top 5 best streams
    const top = scored.slice(0, 5);

    const streams = top.map(({ s, isSpanish, seeds, quality }, idx) => {
      const langLabel = isSpanish ? 'Español Latino' : 'Multi-Audio';
      const cleanTitle = s.title ? s.title.split('\n')[0].replace(/[\[\]]/g, '').slice(0, 40) : `Servidor ${idx + 1}`;

      let magnet = null;
      if (s.infoHash) {
        const trParams = DEFAULT_TRACKERS.map(t => `&tr=${encodeURIComponent(t)}`).join('');
        magnet = `magnet:?xt=urn:btih:${s.infoHash}&dn=${encodeURIComponent(cleanTitle)}${trParams}`;
      } else if (s.url && s.url.startsWith('magnet:')) {
        magnet = s.url;
      }

      const streamSources = (s.sources && s.sources.length > 0) 
        ? s.sources 
        : (s.infoHash ? [`dht:${s.infoHash}`, ...DEFAULT_TRACKERS.map(t => `tracker:${t}`)] : []);

      return {
        magnet,
        quality,
        isSpanish,
        seeds,
        name: `Calidad ${quality}`,
        title: `Opción ${idx + 1} (${quality}) - ${langLabel}`,
        sources: streamSources
      };
    });

    return res.status(200).json({ streams });
  } catch (err) {
    console.error(`Stream resolver error: ${err.message}`);
    return res.status(200).json({ streams: [] });
  }
}
