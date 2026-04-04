// api/autocomplete.js
// Real buyer search intent from Google + Etsy autocomplete
// No API key needed — public endpoints

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword = '' } = req.query;
  const results = {};

  // 1. Google Autocomplete — "etsy [keyword]" variations
  // Shows real buyer search patterns
  const prefixes = [
    'etsy '+keyword,
    'etsy '+keyword+' uk',
    'etsy personalised '+keyword,
    'etsy custom '+keyword,
    'etsy funny '+keyword,
    'etsy gift '+keyword,
    keyword+' gift ideas',
    keyword+' gift for',
    'best '+keyword+' etsy',
    keyword+' for mum',
    keyword+' for her',
    keyword+' wedding'
  ];

  const googleSuggestions = new Set();
  for (const prefix of prefixes.slice(0, 6)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(prefix)}&client=firefox&hl=en-GB`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept-Language': 'en-GB' }
      });
      const data = await r.json();
      const suggestions = data[1] || [];
      suggestions.forEach(s => googleSuggestions.add(s));
    } catch(e) {}
  }
  results.googleBuyerSearches = Array.from(googleSuggestions).slice(0, 30);

  // 2. Etsy Search Suggestions (public autocomplete)
  try {
    const etsyUrl = `https://www.etsy.com/api/v3/ajax/bespoke/search/suggestions?query=${encodeURIComponent(keyword)}&max_results=20`;
    const er = await fetch(etsyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
        'x-detected-locale': 'GBP|en-GB|GB'
      }
    });
    if (er.ok) {
      const ed = await er.json();
      results.etsySuggestions = (ed.results || []).map(s => s.query || s.suggestion || s).filter(Boolean);
    }
  } catch(e) {
    results.etsySuggestions = [];
  }

  // 3. Answer-the-public style — what questions buyers ask
  const questionPrefixes = [
    'how to '+keyword,
    'what '+keyword,
    'where to buy '+keyword,
    'best '+keyword+' for',
    'personalised '+keyword+' ideas',
    keyword+' ideas for',
    keyword+' near me',
    'cheap '+keyword
  ];

  const questionSuggestions = new Set();
  for (const q of questionPrefixes.slice(0, 4)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?q=${encodeURIComponent(q)}&client=firefox&hl=en-GB`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' }
      });
      const data = await r.json();
      (data[1] || []).forEach(s => questionSuggestions.add(s));
    } catch(e) {}
  }
  results.buyerQuestions = Array.from(questionSuggestions).slice(0, 20);

  // 4. TikTok hashtag view counts (public web)
  try {
    const ttUrl = `https://www.tiktok.com/tag/${encodeURIComponent(keyword.replace(/\s+/g,''))}`;
    const tr = await fetch(ttUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Accept': 'text/html'
      }
    });
    const ttHtml = await tr.text();
    // Extract view count from TikTok page
    const viewMatch = ttHtml.match(/"viewCount":\s*(\d+)/);
    const nameMatch = ttHtml.match(/"hashtagName":\s*"([^"]+)"/);
    results.tiktok = {
      hashtag: nameMatch ? nameMatch[1] : keyword.replace(/\s+/g,''),
      views: viewMatch ? parseInt(viewMatch[1]) : null,
      url: ttUrl
    };
  } catch(e) {
    results.tiktok = { hashtag: keyword.replace(/\s+/g,''), views: null };
  }

  // 5. Pinterest search suggestions
  try {
    const pinUrl = `https://www.pinterest.co.uk/search/pins/?q=${encodeURIComponent(keyword)}&rs=typed`;
    const pr = await fetch(pinUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'text/html' }
    });
    const pinHtml = await pr.text();
    // Extract related terms from Pinterest
    const pinMatches = pinHtml.matchAll(/"term"\s*:\s*"([^"]+)"/g);
    const pinTerms = new Set();
    for (const m of pinMatches) {
      if (m[1] && m[1].length > 2 && m[1].length < 50) pinTerms.add(m[1]);
    }
    results.pinterestRelated = Array.from(pinTerms).slice(0, 15);
  } catch(e) {
    results.pinterestRelated = [];
  }

  // 6. Redbubble trending (what designs are popular)
  try {
    const rbUrl = `https://www.redbubble.com/shop/?query=${encodeURIComponent(keyword)}&sortOrder=top+sellers`;
    const rbR = await fetch(rbUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'text/html' }
    });
    const rbHtml = await rbR.text();
    // Extract product titles
    const rbMatches = rbHtml.matchAll(/"title"\s*:\s*"([^"]{5,80})"/g);
    const rbItems = new Set();
    for (const m of rbMatches) {
      if (m[1] && !m[1].includes('Redbubble')) rbItems.add(m[1].trim());
    }
    results.redbubbleTrending = Array.from(rbItems).slice(0, 10);
  } catch(e) {
    results.redbubbleTrending = [];
  }

  return res.status(200).json(results);
}
