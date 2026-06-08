export const config = { runtime: 'edge' };

const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function getEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('archive.org/embed/')) return url;
  const arcMatch = url.match(/archive\.org\/details\/([^\/\?&]+)/);
  if (arcMatch) return `https://archive.org/embed/${arcMatch[1]}`;
  if (url.includes('drive.google.com/file/d/') && url.includes('/preview')) return url;
  const f1 = url.match(/drive\.google\.com\/file\/d\/([^\/\?&]+)/);
  if (f1) return `https://drive.google.com/file/d/${f1[1]}/preview`;
  const f2 = url.match(/[?&]id=([^&]+)/);
  if (f2) return `https://drive.google.com/file/d/${f2[1]}/preview`;
  return url;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const currentSlug = pathParts[pathParts.length - 1];

  // Only handle /video/* routes
  if (!currentSlug || pathParts[1] !== 'video') {
    return new Response('Not found', { status: 404 });
  }

  const ua = req.headers.get('user-agent') || '';
  const isBot = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot/i.test(ua);

  // For real users, just serve the normal video.html (Vercel rewrite handles this)
  // For bots, serve pre-rendered HTML
  if (!isBot) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/video.html' }
    });
  }

  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    const res = await fetch(sheetUrl);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;

    const allVideos = rows.map((row, i) => ({
      id: i,
      title:       row.c[0]?.v || 'Untitled',
      videoUrl:    row.c[1]?.v || '',
      thumbnail:   row.c[2]?.v || '',
      category:    row.c[3]?.v || 'General',
      date:        row.c[4]?.v || '',
      duration:    row.c[5]?.v || '',
      description: row.c[6]?.v || '',
      slug:        slugify(row.c[0]?.v || 'video')
    })).filter(v => v.title !== 'Title').reverse();

    const video = allVideos.find(v => v.slug === currentSlug);

    if (!video) {
      return new Response('<h1>Video not found</h1>', {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const siteUrl = 'https://bd-viral-hub.vercel.app';
    const pageUrl = `${siteUrl}/video/${video.slug}`;
    const embedUrl = getEmbedUrl(video.videoUrl);

    const related = allVideos
      .filter(v => v.id !== video.id && v.category === video.category)
      .slice(0, 8);

    const relatedHTML = related.map(v => `
      <div style="display:inline-block;width:48%;margin:1%;vertical-align:top;">
        <a href="/video/${v.slug}" style="text-decoration:none;color:#f5f5f5;">
          <img src="${v.thumbnail}" alt="${v.title}" style="width:100%;border-radius:6px;" loading="lazy">
          <p style="font-size:0.85rem;margin-top:4px;">${v.title}</p>
        </a>
      </div>`).join('');

    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": video.title,
      "description": video.description || video.title,
      "thumbnailUrl": video.thumbnail,
      "uploadDate": video.date || new Date().toISOString().split('T')[0],
      "contentUrl": video.videoUrl,
      "embedUrl": pageUrl,
      "publisher": { "@type": "Organization", "name": "BD Viral Hub", "url": siteUrl }
    });

    const breadcrumbSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": siteUrl },
        { "@type": "ListItem", "position": 2, "name": video.category, "item": `${siteUrl}/?cat=${video.category}` },
        { "@type": "ListItem", "position": 3, "name": video.title, "item": pageUrl }
      ]
    });

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${video.title} | BD Viral Hub</title>
  <meta name="description" content="${(video.description || video.title).substring(0, 160)} - BD Viral Hub ভাইরাল ভিডিও বাংলাদেশ">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:title" content="${video.title} | BD Viral Hub">
  <meta property="og:description" content="${video.description || video.title}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="video.other">
  <meta property="og:image" content="${video.thumbnail}">
  <meta property="og:site_name" content="BD Viral Hub">
  <script type="application/ld+json">${schema}</script>
  <script type="application/ld+json">${breadcrumbSchema}</script>
  <style>
    body { background:#0d0d0d; color:#f5f5f5; font-family:sans-serif; margin:0; padding:0; }
    header { background:#111; border-bottom:2px solid #ff3d3d; padding:12px 4%; }
    header a { color:#f5f5f5; text-decoration:none; font-size:1.5rem; font-weight:bold; }
    header a span { color:#ff3d3d; }
    .main { max-width:900px; margin:0 auto; padding:1rem 2%; }
    .breadcrumb { font-size:0.8rem; color:#888; margin-bottom:1rem; }
    .breadcrumb a { color:#888; text-decoration:none; }
    h1 { font-size:1.4rem; margin-bottom:0.75rem; }
    .player { position:relative; padding-top:56.25%; background:#000; border-radius:10px; overflow:hidden; margin-bottom:1rem; }
    .player iframe { position:absolute; inset:0; width:100%; height:100%; border:none; }
    .meta { color:#888; font-size:0.85rem; margin-bottom:1rem; }
    .description { background:#222; border-left:3px solid #ff3d3d; padding:0.75rem 1rem; border-radius:6px; font-size:0.9rem; line-height:1.7; margin-bottom:1.5rem; }
    .related-title { font-size:1.1rem; font-weight:bold; margin-bottom:0.75rem; }
    .back { display:inline-block; margin-bottom:1rem; color:#888; text-decoration:none; border:1px solid #333; padding:4px 12px; border-radius:6px; }
  </style>
</head>
<body>
<header>
  <a href="/">BD Viral<span>Hub</span></a>
</header>
<div class="main">
  <a class="back" href="/">← হোমে ফিরুন</a>
  <div class="breadcrumb">
    <a href="/">Home</a> › <a href="/?cat=${video.category}">${video.category}</a> › ${video.title}
  </div>
  <h1>${video.title}</h1>
  <div class="player">
    <iframe src="${embedUrl}" allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>
  </div>
  <div class="meta">📁 ${video.category}${video.date ? ` · 📅 ${video.date}` : ''}${video.duration ? ` · ⏱ ${video.duration}` : ''}</div>
  ${video.description ? `<div class="description">${video.description}</div>` : ''}
  ${related.length ? `<div class="related-title">Related Videos</div><div>${relatedHTML}</div>` : ''}
</div>
<script>
  // Redirect real users to the full JS version after bot gets static HTML
  const ua = navigator.userAgent.toLowerCase();
  const isBot = /googlebot|bingbot/.test(ua);
  if (!isBot) {
    // Already on correct page, load full JS version
    window.location.href = window.location.href;
  }
</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
      }
    });

  } catch (e) {
    return new Response(`<h1>Error: ${e.message}</h1>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
