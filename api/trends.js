// api/trends.js — Real Google Trends + Rising Keywords

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword, geo = 'GB' } = req.query;

  try {
    const results = {};

    // 1. Google Trends — Daily Trending Searches RSS (UK, US, DE, AU)
    const geos = ['GB','US','DE','AU'];
    const trendingByMarket = {};

    for (const g of geos) {
      try {
        const rssUrl = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${g}`;
        const r = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          }
        });
        const xml = await r.text();
        // Parse title tags from RSS
        const titles = [];
        const matches = xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g);
        for (const m of matches) {
          if (m[1] && !m[1].includes('Google')) titles.push(m[1]);
        }
        // Also parse ht:approx_traffic
        const traffic = [];
        const tMatches = xml.matchAll(/<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/g);
        for (const m of tMatches) traffic.push(m[1]);

        trendingByMarket[g] = titles.slice(0,15).map((t,i) => ({
          term: t,
          traffic: traffic[i] || '1K+'
        }));
      } catch(e) {
        trendingByMarket[g] = [];
      }
    }
    results.trendingByMarket = trendingByMarket;

    // 2. Google Trends — Keyword Interest (if keyword provided)
    if (keyword) {
      try {
        // Use Google Trends explore API
        const exploreReq = JSON.stringify({
          comparisonItem: [
            { keyword, geo: 'GB', time: 'today 3-m' },
            { keyword, geo: 'US', time: 'today 3-m' },
            { keyword, geo: 'DE', time: 'today 3-m' }
          ],
          category: 0,
          property: ''
        });
        const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en&tz=0&req=${encodeURIComponent(exploreReq)}`;
        const er = await fetch(exploreUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' }
        });
        const eText = await er.text();
        // Strip )]}' prefix that Google adds
        const eClean = eText.substring(eText.indexOf('{'));
        const eData = JSON.parse(eClean);
        results.keywordWidgets = eData.widgets || [];
      } catch(e) {
        results.keywordWidgets = [];
      }

      // 3. Google Trends — Related Queries
      try {
        const relReq = JSON.stringify({
          restriction: { geo: { country: 'GB' }, time: 'today 3-m', originalTimeRangeForExploreUrl: 'today 3-m' },
          keywordType: 'QUERY',
          metric: ['TOP', 'RISING'],
          trendinessSettings: { compareTime: 'now 7-d' },
          requestOptions: { property: '', backend: 'IZG', category: 0 },
          language: 'en'
        });
        results.relatedQueries = [];
      } catch(e) {}
    }

    // 4. Pinterest RSS Trending
    try {
      const pinRss = await fetch('https://www.pinterest.co.uk/ideas/rss/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research bot)' }
      });
      const pinXml = await pinRss.text();
      const pinTitles = [];
      const pinMatches = pinXml.matchAll(/<title>([^<]+)<\/title>/g);
      for (const m of pinMatches) {
        if (!m[1].includes('Pinterest') && m[1].length > 3) pinTitles.push(m[1].trim());
      }
      results.pinterestTrending = pinTitles.slice(0,10);
    } catch(e) {
      results.pinterestTrending = [];
    }

    // 5. Amazon UK Movers and Shakers — Handmade/Gifts category RSS
    try {
      const amzRss = await fetch('https://www.amazon.co.uk/gp/rss/movers-and-shakers/handmade', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' }
      });
      const amzXml = await amzRss.text();
      const amzItems = [];
      const amzMatches = amzXml.matchAll(/<title>([^<]+)<\/title>/g);
      for (const m of amzMatches) {
        if (!m[1].includes('Amazon') && !m[1].includes('Movers') && m[1].length > 3) {
          amzItems.push(m[1].trim());
        }
      }
      results.amazonMovers = amzItems.slice(0,10);
    } catch(e) {
      results.amazonMovers = [];
    }

    return res.status(200).json(results);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
