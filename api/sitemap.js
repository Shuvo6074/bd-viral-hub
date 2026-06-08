const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

let cachedSitemap = null;
let cacheTime = 0;
const CACHE_TTL = 3600000;

module.exports = async function handler(req, res) {
  const siteUrl = 'https://bd-viral-hub.vercel.app';

  if (cachedSitemap && Date.now() - cacheTime < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(cachedSitemap);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const API_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const response = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await response.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;

    const today = new Date().toISOString().split('T')[0];

    function parseSheetDate(val) {
      if (!val) return today;
      // Google Sheets date format: "Date(2026,5,2)" — month is 0-indexed
      const match = String(val).match(/Date\((\d+),(\d+),(\d+)\)/);
      if (match) {
        const y = match[1];
        const m = String(parseInt(match[2]) + 1).padStart(2, '0');
        const d = String(match[3]).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      // If already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      // Fallback: try Date parse
      try {
        const parsed = new Date(val);
        if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
      } catch(e) {}
      return today;
    }

    const videos = rows.map((row) => ({
      title: row.c[0]?.v || 'video',
      date: parseSheetDate(row.c[4]?.v),
      slug: slugify(row.c[0]?.v || 'video')
    })).filter(v => v.title !== 'Title');

    const urls = videos.map(v => `
  <url>
    <loc>${siteUrl}/video/${v.slug}</loc>
    <lastmod>${v.date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${urls}
</urlset>`;

    cachedSitemap = sitemap;
    cacheTime = Date.now();

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(sitemap);

  } catch(e) {
    if (cachedSitemap) {
      res.setHeader('Content-Type', 'application/xml');
      return res.status(200).send(cachedSitemap);
    }
    res.status(500).send('Error: ' + e.message);
  }
};
