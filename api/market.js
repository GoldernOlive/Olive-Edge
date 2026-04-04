// api/market.js — Real market data: Reddit, eBay, Printify, Printful

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword = '' } = req.query;
  const kw = encodeURIComponent(keyword);
  const results = { keyword, sources: {} };

  // 1. REDDIT — Multiple communities
  const subreddits = ['EtsySellers','Etsy','printOnDemand','Handmade','smallbusiness'];
  const redditPosts = [];
  for (const sub of subreddits) {
    try {
      const r = await fetch(
        `https://www.reddit.com/r/${sub}/search.json?q=${kw}&sort=hot&limit=5&restrict_sr=1`,
        { headers: { 'User-Agent': 'OliveEdge/1.0' } }
      );
      const d = await r.json();
      const posts = (d.data?.children || []).map(p => ({
        subreddit: sub,
        title: p.data.title,
        score: p.data.score,
        comments: p.data.num_comments,
        url: `https://reddit.com${p.data.permalink}`,
        created: p.data.created_utc,
        flair: p.data.link_flair_text || ''
      }));
      redditPosts.push(...posts);
    } catch(e) {}
  }
  // Sort by score
  results.sources.reddit = redditPosts
    .sort((a,b) => b.score - a.score)
    .slice(0,15);

  // 2. REDDIT — Top sellers discussions (no keyword filter)
  try {
    const hotR = await fetch(
      'https://www.reddit.com/r/EtsySellers/hot.json?limit=10',
      { headers: { 'User-Agent': 'OliveEdge/1.0' } }
    );
    const hotD = await hotR.json();
    results.sources.redditHot = (hotD.data?.children || []).map(p => ({
      title: p.data.title,
      score: p.data.score,
      comments: p.data.num_comments,
      url: `https://reddit.com${p.data.permalink}`
    }));
  } catch(e) { results.sources.redditHot = []; }

  // 3. PRINTIFY — Real catalogue products
  try {
    const pfyR = await fetch('https://api.printify.com/v1/catalog/blueprints.json');
    const pfyD = await pfyR.json();
    const kwLower = keyword.toLowerCase();
    const filtered = (pfyD || []).filter(p =>
      p.title?.toLowerCase().includes(kwLower.split(' ')[0])
    ).slice(0,8);
    const all = (pfyD || []).slice(0,5); // top products regardless
    results.sources.printify = {
      total: (pfyD || []).length,
      matching: filtered.map(p => ({
        id: p.id,
        title: p.title,
        brand: p.brand,
        model: p.model
      })),
      popular: all.map(p => ({ id: p.id, title: p.title }))
    };
  } catch(e) { results.sources.printify = { total: 0, matching: [], popular: [] }; }

  // 4. PRINTFUL — Real catalogue
  try {
    const pflR = await fetch('https://api.printful.com/products');
    const pflD = await pflR.json();
    const kwLower = keyword.toLowerCase();
    const items = pflD.result || [];
    const filtered = items.filter(p =>
      p.type_name?.toLowerCase().includes(kwLower.split(' ')[0])
    ).slice(0,8);
    results.sources.printful = {
      total: items.length,
      matching: filtered.map(p => ({
        id: p.id,
        type: p.type,
        title: p.type_name,
        image: p.image
      }))
    };
  } catch(e) { results.sources.printful = { total: 0, matching: [] }; }

  // 5. EBAY UK — Real sold prices via Finding API approach
  // Use eBay's public search to get pricing signals
  try {
    const ebayUrl = `https://www.ebay.co.uk/sch/i.html?_nkw=${kw}&_sop=13&LH_Sold=1&LH_Complete=1&_ipg=20`;
    const ebayR = await fetch(ebayUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'text/html',
        'Accept-Language': 'en-GB,en'
      }
    });
    const ebayHtml = await ebayR.text();

    // Extract prices from eBay sold listings
    const prices = [];
    const priceMatches = ebayHtml.matchAll(/£([\d,]+\.?\d*)/g);
    for (const m of priceMatches) {
      const price = parseFloat(m[1].replace(',',''));
      if (price > 0.5 && price < 500) prices.push(price);
    }
    prices.sort((a,b) => a-b);

    // Extract listing titles
    const titles = [];
    const titleMatches = ebayHtml.matchAll(/class="s-item__title[^"]*">([^<]+)</g);
    for (const m of titleMatches) {
      if (!m[1].includes('Shop on eBay') && m[1].length > 5) titles.push(m[1].trim());
    }

    results.sources.ebayUK = {
      soldListings: titles.slice(0,10),
      prices: prices.slice(0,20),
      avgPrice: prices.length ? (prices.reduce((s,p)=>s+p,0)/prices.length).toFixed(2) : null,
      minPrice: prices.length ? prices[0].toFixed(2) : null,
      maxPrice: prices.length ? prices[prices.length-1].toFixed(2) : null,
      medianPrice: prices.length ? prices[Math.floor(prices.length/2)].toFixed(2) : null
    };
  } catch(e) {
    results.sources.ebayUK = { error: e.message, soldListings: [], prices: [] };
  }

  // 6. NOTHS (Not On The High Street) — UK gift market
  try {
    const nothsR = await fetch(
      `https://www.notonthehighstreet.com/search?search_term=${kw}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'text/html' } }
    );
    const nothsHtml = await nothsR.text();
    const nothsPrices = [];
    const nothsMatches = nothsHtml.matchAll(/£([\d]+\.?\d*)/g);
    for (const m of nothsMatches) {
      const p = parseFloat(m[1]);
      if (p > 1 && p < 200) nothsPrices.push(p);
    }
    nothsPrices.sort((a,b)=>a-b);
    results.sources.noths = {
      avgPrice: nothsPrices.length ? (nothsPrices.reduce((s,p)=>s+p,0)/nothsPrices.length).toFixed(2) : null,
      minPrice: nothsPrices.length ? nothsPrices[0].toFixed(2) : null,
      maxPrice: nothsPrices.length ? nothsPrices[nothsPrices.length-1].toFixed(2) : null
    };
  } catch(e) { results.sources.noths = {}; }

  // 7. GOOGLE TRENDS for this keyword
  try {
    const trendsRss = await fetch(
      `https://trends.google.com/trends/trendingsearches/daily/rss?geo=GB`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    );
    const xml = await trendsRss.text();
    const titles = [];
    const matches = xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/g);
    for (const m of matches) titles.push(m[1]);
    results.sources.googleTrendingUK = titles.slice(0,20);
  } catch(e) { results.sources.googleTrendingUK = []; }

  return res.status(200).json(results);
}
