import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';
const SITE_URL = 'https://bd-viral-hub.vercel.app';

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0980-\u09FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ── পারফরম্যান্স ফিক্স: index.js-এর মতোই থাম্বনেইল একটা free
// image-proxy (images.weserv.nl) দিয়ে ছোট/optimized সাইজে দ্রুত লোড ──
function thumbUrl(url, width) {
  if (!url) return url;
  const clean = url.replace(/^https?:\/\//, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${width}&q=75&output=webp`;
}

// index.js-এর PER_PAGE-এর সাথে অবশ্যই মিলতে হবে, নাহলে pageBatch নম্বর গরমিল হবে
const PER_PAGE = 30;

// একটা ভিডিও একাধিক ক্যাটাগরিতে থাকতে পারবে — Sheets-এ কমা (,) দিয়ে
// আলাদা করে লিখলেই ভিডিওটা দুই জায়গাতেই দেখাবে (index.js-এর সাথে consistent)
function parseCategories(str) {
  const arr = (str || '').split(',').map(s => s.trim()).filter(Boolean);
  return arr.length ? arr : ['General'];
}

// একই টাইটেল বারবার এলে slug-এর শেষে -2, -3 ... যোগ হবে, যাতে প্রতিটা
// ভিডিওর নিজস্ব আলাদা URL থাকে। index.js আর sitemap.js-এও এই একই
// লজিক ব্যবহার করা হয়েছে, তাই সব জায়গায় slug মিলে যাবে।
function getUniqueSlugs(rows, slugifyFn) {
  const counts = {};
  return rows.map(row => {
    const base = slugifyFn(row.c[0]?.v || 'video');
    counts[base] = (counts[base] || 0) + 1;
    return counts[base] > 1 ? `${base}-${counts[base]}` : base;
  });
}

// ⚠️ ভিউ কাউন্ট এখন Google Form-এর মাধ্যমে জমা হয় (Apps Script লাগে না)
const VIEW_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScWpnit1sXMbza8XgWmdVV065Y6oYFC9zWEu7i0tGBoQW0S8w/formResponse';
const VIEW_FORM_ENTRY = 'entry.1785504240';
const VIEW_RESPONSES_SHEET_ID = '1-y075MwICFApp4D6Ie-7FxDNVl-pkJHpQSiu396nQoI';

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

export async function getServerSideProps({ params, res: httpRes }) {
  // ── পারফরম্যান্স ফিক্স: index.js-এর মতোই এই পেজও Edge-এ ৬০ সেকেন্ড
  // cache হবে, দ্বিতীয়বার একই ভিডিও পেজে কেউ গেলে সাথে সাথে লোড হবে। ──
  httpRes.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;
    const uniqueSlugs = getUniqueSlugs(rows, slugify);

    const allVideos = rows.map((row, i) => ({
      id: i,
      title:       row.c[0]?.v || 'Untitled',
      videoUrl:    row.c[1]?.v || '',
      thumbnail:   row.c[2]?.v || `https://picsum.photos/seed/${i}/640/360`,
      categories:  parseCategories(row.c[3]?.v),
      date:        row.c[4]?.v || '',
      duration:    row.c[5]?.v || '',
      description: row.c[6]?.v || '',
      slug:        uniqueSlugs[i]
    })).filter(v => v.title !== 'Title').reverse()
      .map((v, idx) => ({ ...v, pageBatch: Math.floor(idx / PER_PAGE) + 1 }));

    const video = allVideos.find(v => v.slug === params.slug);
    if (!video) return { notFound: true };

    // ── Related videos: প্রতিটা ক্যাটাগরি থেকে কিছু (৫টা করে) ভিডিও,
    // আর ভিডিওটা হোমপেজের যেই "ব্যাচ/পেজ"-এ ছিল সেখান থেকেও ২-৩টা ভিডিও।
    // যেহেতু pageBatch প্রতিটা ভিডিওর নিজস্ব বৈশিষ্ট্য, কেউ যদি এই
    // batch-related ভিডিওগুলোর একটাতে ক্লিক করে, সেই ভিডিওর পেজেও আবার
    // একই ব্যাচ থেকে related ভিডিও আসতে থাকবে — চেইন হিসেবে চলতে থাকে। ──
    const usedIds = new Set([video.id]);
    const categoryRelated = [];
    video.categories.forEach(cat => {
      const matches = allVideos.filter(v => !usedIds.has(v.id) && v.categories.includes(cat)).slice(0, 5);
      matches.forEach(v => { categoryRelated.push(v); usedIds.add(v.id); });
    });
    const batchRelated = allVideos.filter(v => !usedIds.has(v.id) && v.pageBatch === video.pageBatch).slice(0, 3);
    batchRelated.forEach(v => usedIds.add(v.id));
    const related = [...categoryRelated, ...batchRelated].slice(0, 24);

    return { props: { video, related } };
  } catch(e) {
    return { notFound: true };
  }
}

export default function VideoPage({ video, related }) {
  const [likes, setLikes] = useState({});
  const [views, setViews] = useState({});
  const [liked, setLiked] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const SMARTLINK_URL = 'https://www.effectivecpmnetwork.com/z5yped96?key=51bf89de175c32426c4db7dc8e8c51d9';

  function handleOverlayClick() {
    window.open(SMARTLINK_URL, '_blank');
    setShowOverlay(false);
  }

  function handleRelatedClick(e, slug) {
    e.preventDefault();
    window.open(SMARTLINK_URL, '_blank');
    setTimeout(() => { window.location.href = `/video/${slug}`; }, 50);
  }

  useEffect(() => {
    try {
      const l = JSON.parse(localStorage.getItem('vhub_likes') || '{}');
      setLikes(l);
      setLiked(!!l[video.id]);
    } catch(e) {}

    // ── ভিউ কাউন্ট: প্রতিবার পেজ খুললে এই ভিডিওর slug একটা Google Form-এ
    // জমা (submit) হয়। এটাই একটা "ভিউ" হিসেবে গণনা হয়। সব ভিজিটরের
    // জমা একই Response Sheet-এ গিয়ে জমা হয়, তাই এটা সবার জন্য COMMON,
    // real সংখ্যা — localStorage-এর মতো নিজের ব্রাউজারে সীমাবদ্ধ না। ──
    try {
      const formData = new URLSearchParams();
      formData.append(VIEW_FORM_ENTRY, video.slug);
      fetch(VIEW_FORM_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Form নিজে থেকেই এটা require করে, রেসপন্স পড়া যায় না কিন্তু submit ঠিকই হয়
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      }).catch(() => {});
    } catch(e) {}

    // Response Sheet থেকে সব ভিডিওর মোট ভিউ (কতবার প্রতিটা slug জমা
    // পড়েছে) গুনে আনা — homepage/related section-এ real সংখ্যা দেখানোর জন্য
    fetch(`https://docs.google.com/spreadsheets/d/${VIEW_RESPONSES_SHEET_ID}/gviz/tq?tqx=out:json`)
      .then(res => res.text())
      .then(text => {
        const json = JSON.parse(text.substring(47, text.length - 2));
        const counts = {};
        json.table.rows.forEach(row => {
          const s = row.c[1]?.v; // কলাম B = slug
          if (s) counts[s] = (counts[s] || 0) + 1;
        });
        setViews(counts);
      })
      .catch(() => {});
  }, [video.id]);

  // Inject highperformanceformat.com 728x90 banner ads (isolated iframe, runs twice)
  useEffect(() => {
    function buildAdIframe(key, width, height) {
      const iframe = document.createElement('iframe');
      iframe.style.width = width + 'px';
      iframe.style.height = height + 'px';
      iframe.style.maxWidth = '100%';
      iframe.style.border = '0';
      iframe.style.overflow = 'hidden';
      iframe.scrolling = 'no';

      const html = `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;overflow:hidden;}</style></head><body>
<script type="text/javascript">
atOptions = {
  'key' : '${key}',
  'format' : 'iframe',
  'height' : ${height},
  'width' : ${width},
  'params' : {}
};
</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/${key}/invoke.js"></script>
</body></html>`;

      iframe.srcdoc = html;
      return iframe;
    }

    ['ad-banner-bottom-1', 'ad-banner-bottom-2', 'ad-banner-mid'].forEach(id => {
      const container = document.getElementById(id);
      if (!container || container.dataset.loaded) return;
      container.dataset.loaded = 'true';
      container.appendChild(buildAdIframe('408f7fe8d5566eee24a05d83101d2638', 300, 250));
    });
  }, [video.id]);

  function toggleLike() {
    const newLikes = { ...likes };
    if (newLikes[video.id]) { delete newLikes[video.id]; setLiked(false); }
    else { newLikes[video.id] = 1; setLiked(true); }
    setLikes(newLikes);
    localStorage.setItem('vhub_likes', JSON.stringify(newLikes));
  }

  function shareVideo() {
    const url = `${SITE_URL}/video/${video.slug}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: video.title + ' | BD Viral Hub', url });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => alert('লিংক কপি হয়েছে!'));
    }
  }

  const pageUrl = `${SITE_URL}/video/${video.slug}`;
  const embedUrl = getEmbedUrl(video.videoUrl);
  const isDirectVideo = /\.(mp4|webm|ogg|mov)/i.test(video.videoUrl) &&
    !video.videoUrl.includes('drive.google.com') &&
    !video.videoUrl.includes('archive.org');

  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": video.title,
    "description": video.description || video.title,
    "thumbnailUrl": video.thumbnail,
    "uploadDate": video.date || new Date().toISOString().split('T')[0],
    "contentUrl": video.videoUrl,
    "embedUrl": pageUrl,
    "publisher": { "@type": "Organization", "name": "BD Viral Hub", "url": SITE_URL }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": video.categories[0], "item": `${SITE_URL}/?cat=${video.categories[0]}` },
      { "@type": "ListItem", "position": 3, "name": video.title, "item": pageUrl }
    ]
  };

  return (
    <>
      <Head>
        <title>{video.title} | BD Viral Hub</title>
        <meta name="description" content={(video.description || video.title) + ' - BD Viral Hub ভাইরাল ভিডিও বাংলাদেশ ২০২৬'} />
        <meta name="robots" content="index, follow" />
        <meta name="rating" content="adult" />
        <meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={video.title + ' | BD Viral Hub'} />
        <meta property="og:description" content={video.description || video.title} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="video.other" />
        <meta property="og:image" content={video.thumbnail} />
        <meta property="og:site_name" content="BD Viral Hub" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
        <script src="https://pl29731011.effectivecpmnetwork.com/5c/5f/a8/5c5fa829d1b2adb187a491231ec4716f.js"></script>
        <style>{`
          :root{--bg:#0d0d0d;--surface:#181818;--surface2:#222;--accent:#ff3d3d;--text:#f5f5f5;--muted:#888;--border:#2a2a2a;--radius:10px;}
          *{margin:0;padding:0;box-sizing:border-box;}
          body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;}
          header{background:#111;border-bottom:2px solid var(--accent);padding:0 4%;position:sticky;top:0;z-index:200;}
          .header-inner{max-width:1400px;margin:0 auto;display:flex;align-items:center;height:60px;gap:1rem;}
          .logo{font-family:'Bebas Neue',sans-serif;font-size:1.8rem;letter-spacing:2px;color:var(--text);text-decoration:none;}
          .logo span{color:var(--accent);}
          .main{max-width:1400px;margin:0 auto;padding:1rem 2%;}
          .back-btn{display:inline-flex;align-items:center;gap:0.5rem;color:var(--muted);background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.4rem 1rem;cursor:pointer;font-family:inherit;font-size:0.85rem;margin-bottom:1rem;text-decoration:none;transition:all 0.2s;}
          .back-btn:hover{color:var(--text);border-color:var(--accent);}
          .player-layout{display:grid;grid-template-columns:1fr 320px;gap:1.5rem;}
          @media(max-width:768px){.player-layout{grid-template-columns:1fr;}.related-sidebar{display:none !important;}.related-mobile{display:block !important;}}
          .video-container{position:relative;padding-top:56.25%;background:#000;border-radius:var(--radius);overflow:hidden;margin-bottom:1rem;}
          .video-container video,.video-container iframe{position:absolute;inset:0;width:100%;height:100%;border:none;}
          .video-overlay{position:absolute;inset:0;width:100%;height:100%;background:transparent;cursor:pointer;z-index:10;}
          .video-title-big{font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:0.5px;margin-bottom:0.75rem;line-height:1.2;}
          .video-stats-row{display:flex;gap:1.5rem;color:var(--muted);font-size:0.82rem;margin-bottom:1rem;flex-wrap:wrap;}
          .video-actions{display:flex;gap:0.6rem;flex-wrap:nowrap;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border);overflow-x:auto;}
          .action-btn{display:flex;align-items:center;gap:0.35rem;padding:0.45rem 0.9rem;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit;font-size:0.82rem;font-weight:600;transition:all 0.2s;text-decoration:none;white-space:nowrap;}
          .action-btn:hover{border-color:var(--accent);color:var(--accent);}
          .action-btn.liked{background:var(--accent);border-color:var(--accent);color:#fff;}
          .download-btn{background:#2563eb;border-color:#2563eb;color:#fff;}
          .download-btn:hover{background:#1d4ed8;border-color:#1d4ed8;color:#fff;}
          .share-btn{background:#16a34a;border-color:#16a34a;color:#fff;}
          .share-btn:hover{background:#15803d;border-color:#15803d;color:#fff;}
          .video-description{color:#ccc;font-size:0.9rem;line-height:1.7;margin-bottom:1rem;padding:0.75rem 1rem;background:var(--surface2);border-radius:var(--radius);border-left:3px solid var(--accent);}
          .related-section-title{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;margin-bottom:1rem;letter-spacing:1px;}
          .related-list{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;}
          @media(min-width:600px){.related-list{grid-template-columns:repeat(3,1fr);}}
          @media(min-width:1024px){.player-layout .related-sidebar .related-list{grid-template-columns:repeat(2,1fr);}}
          .related-card{background:var(--surface);overflow:hidden;cursor:pointer;transition:box-shadow 0.2s;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;display:block;}
          .related-card:hover{box-shadow:0 4px 20px rgba(255,61,61,0.2);}
          .related-thumb{position:relative;width:100%;padding-top:56.25%;background:#000;overflow:hidden;}
          .related-thumb img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;transition:transform 0.3s;}
          .related-card:hover .related-thumb img{transform:scale(1.03);}
          .related-info{padding:0.6rem;}
          .related-title-text{font-size:0.85rem;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin-bottom:0.4rem;}
          .related-meta{font-size:0.72rem;color:var(--muted);}
          .breadcrumb{font-size:0.8rem;color:var(--muted);margin-bottom:1rem;}
          .breadcrumb a{color:var(--muted);text-decoration:none;}
          .breadcrumb a:hover{color:var(--accent);}
          .related-mobile{display:none;}
          .ad-banner-slot{display:flex;justify-content:center;margin:1rem 0;overflow:hidden;}
          .ad-banner-slot iframe{max-width:100%;}
        `}</style>
      </Head>

      <header>
        <div className="header-inner">
          <a className="logo" href="/">BD Viral<span>Hub</span></a>
        </div>
      </header>

      <div className="main">
        <a className="back-btn" href="/">← হোমে ফিরুন</a>

        <div className="breadcrumb">
          <a href="/">Home</a> › <a href={`/?cat=${video.categories[0]}`}>{video.categories.join(', ')}</a> › {video.title}
        </div>

        <div className="player-layout">
          <div className="player-main">
            <div className="video-container">
              {isDirectVideo ? (
                <video controls autoPlay playsInline preload="metadata" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000', objectFit: 'contain' }}>
                  <source src={video.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <iframe
                  src={embedUrl}
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#000' }}
                />
              )}
              {showOverlay && (
                <div className="video-overlay" onClick={handleOverlayClick}></div>
              )}
            </div>

            <h1 className="video-title-big">{video.title}</h1>

            <div className="video-stats-row">
              <span>👁 {formatNum(views[video.slug] || 0)} views</span>
              <span>❤️ {formatNum(likes[video.id] || 0)} likes</span>
              <span>📁 {video.categories.join(', ')}</span>
              {video.date && <span>📅 {video.date}</span>}
            </div>

            {video.description && (
              <p className="video-description">{video.description}</p>
            )}

            <div className="video-actions">
              <button className="action-btn download-btn" onClick={e => e.preventDefault()}>⬇️ Download</button>
              <button className={`action-btn${liked ? ' liked' : ''}`} onClick={toggleLike}>
                ❤️ {formatNum(likes[video.id] || 0)} Like
              </button>
              <button className="action-btn share-btn" onClick={shareVideo}>🔗 Share</button>
            </div>

            {/* 300x250 Banner Ad - below player, above related */}
            <div style={{display:'flex',justifyContent:'center',margin:'1rem 0'}}>
              <div className="ad-banner-slot" id="ad-banner-mid"></div>
            </div>

            {/* Mobile related */}
            <div className="related-mobile">
              <div className="related-section-title">Related Videos</div>
              <div className="related-list">
                {related.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>No related videos</p>
                ) : related.map(v => (
                  <a key={v.id} className="related-card" href={`/video/${v.slug}`} onClick={e => handleRelatedClick(e, v.slug)}>
                    <div className="related-thumb">
                      <img src={thumbUrl(v.thumbnail, 320)} alt={v.title} loading="lazy" onError={e => { e.target.src = `https://picsum.photos/seed/${v.id}/320/180`; }} />
                    </div>
                    <div className="related-info">
                      <div className="related-title-text">{v.title}</div>
                      <div className="related-meta">👁 {formatNum(views[v.slug] || 0)} · {v.categories.join(', ')}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="related-sidebar">
            <div className="related-section-title">Related Videos</div>
            <div className="related-list">
              {related.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>No related videos</p>
              ) : related.map(v => (
                <a key={v.id} className="related-card" href={`/video/${v.slug}`} onClick={e => handleRelatedClick(e, v.slug)}>
                  <div className="related-thumb">
                    <img src={thumbUrl(v.thumbnail, 320)} alt={v.title} loading="lazy" onError={e => { e.target.src = `https://picsum.photos/seed/${v.id}/320/180`; }} />
                  </div>
                  <div className="related-info">
                    <div className="related-title-text">{v.title}</div>
                    <div className="related-meta">👁 {formatNum(views[v.slug] || 0)} · {v.categories.join(', ')}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 300x250 Banner Ad - below related videos */}
        <div style={{display:'flex',justifyContent:'center',margin:'1rem 0'}}>
          <div className="ad-banner-slot" id="ad-banner-bottom-1"></div>
        </div>

        {/* 300x250 Banner Ad - second one below related videos */}
        <div style={{display:'flex',justifyContent:'center',margin:'1rem 0'}}>
          <div className="ad-banner-slot" id="ad-banner-bottom-2"></div>
        </div>

      </div>
    </>
  );
            }
