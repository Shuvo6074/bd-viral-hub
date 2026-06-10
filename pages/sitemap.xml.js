const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

export default function Sitemap() { return null; }

export async function getServerSideProps({ res }) {
  const siteUrl = 'https://bd-viral-hub.vercel.app';
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
    const text = await response.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;
    const today = new Date().toISOString().split('T')[0];

    const videos = rows.map(row => ({
      title: row.c[0]?.v || 'video',
      slug: slugify(row.c[0]?.v || 'video')
    })).filter(v => v.title !== 'Title');

    const urls = videos.map(v => `
  <url>
    <loc>${siteUrl}/video/${v.slug}</loc>
    <lastmod>${today}</lastmod>
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
    res.write(sitemap);
    res.end();
  } catch(e) {
    res.write('Error');
    res.end();
  }
  return { props: {} };
}
