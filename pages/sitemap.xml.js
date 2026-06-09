const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

export default async function handler(req, res) {
  const siteUrl = 'https://bd-viral-hub.vercel.app';

  try {
    const API_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const response = await fetch(API_URL);
    const text = await response.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;

    const today = new Date().toISOString().split('T')[0];

    function parseSheetDate(val) {
      if (!val) return today;
      const match = String(val).match(/Date\((\d+),(\d+),(\d+)\)/);
      if (match) {
        const y = match[1];
        const m = String(parseInt(match[2]) + 1).padStart(2, '0');
        const d = String(match[3]).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
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

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.status(200).send(sitemap);

  } catch(e) {
    res.status(500).send('Error: ' + e.message);
  }
    }
