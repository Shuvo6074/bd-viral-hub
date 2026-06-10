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

export async function getServerSideProps({ params }) {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const rows = json.table.rows;

    const allVideos = rows.map((row, i) => ({
      id: i,
      title:       row.c[0]?.v || 'Untitled',
      videoUrl:    row.c[1]?.v || '',
      thumbnail:   row.c[2]?.v || `https://picsum.photos/seed/${i}/640/360`,
      category:    row.c[3]?.v || 'General',
      date:        row.c[4]?.v || '',
      duration:    row.c[5]?.v || '',
      description: row.c[6]?.v || '',
      slug:        slugify(row.c[0]?.v || 'video')
    })).filter(v => v.title !== 'Title').reverse();

    const video = allVideos.find(v => v.slug === params.slug);
    if (!video) return { notFound: true };

    const related = allVideos.filter(v => v.id !== video.id && v.category === video.category).slice(0, 12);

    return { props: { video, related } };
  } catch(e) {
    return { notFound: true };
  }
}

export default function VideoPage({ video, related }) {
  const [likes, setLikes] = useState({});
  const [views, setViews] = useState({});
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    try {
      const l = JSON.parse(localStorage.getItem('vhub_likes') || '{}');
      const v = JSON.parse(localStorage.getItem('vhub_views') || '{}');
      setLikes(l);
      setViews(v);
      setLiked(!!l[video.id]);
      v[video.id] = (v[video.id] || 0) + 1;
      localStorage.setItem('vhub_views', JSON.stringify(v));
      setViews({ ...v });
    } catch(e) {}
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
      { "@type": "ListItem", "position": 2, "name": video.category, "item": `${SITE_URL}/?cat=${video.category}` },
      { "@type": "ListItem", "position": 3, "name": video.title, "item": pageUrl }
    ]
  };

  return (
    <>
      <Head>
        <title>{video.title} | BD Viral Hub</title>
        <meta name="description" content={(video.description || video.title) + ' - BD Viral Hub ভাইরাল ভিডিও বাংলাদেশ ২০২৬'} />
        <meta name="robots" content="index, follow" />
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
          .video-title-big{font-family:'Bebas Neue',sans-serif;font-size:1.5rem;letter-spacing:0.5px;margin-bottom:0.75rem;line-height:1.2;}
          .video-stats-row{display:flex;gap:1.5rem;color:var(--muted);font-size:0.82rem;margin-bottom:1rem;flex-wrap:wrap;}
          .video-actions{display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border);}
          .action-btn{display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1.1rem;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:600;transition:all 0.2s;text-decoration:none;}
          .action-btn:hover{border-color:var(--accent);color:var(--accent);}
          .action-btn.liked{background:var(--accent);border-color:var(--accent);color:#fff;}
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
          <a href="/">Home</a> › <a href={`/?cat=${video.category}`}>{video.category}</a> › {video.title}
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
            </div>

            <h1 className="video-title-big">{video.title}</h1>

            <div className="video-stats-row">
              <span>👁 {formatNum(views[video.id] || 0)} views</span>
              <span>❤️ {formatNum(likes[video.id] || 0)} likes</span>
              <span>📁 {video.category}</span>
              {video.date && <span>📅 {video.date}</span>}
            </div>

            {video.description && (
              <p className="video-description">{video.description}</p>
            )}

            <div className="video-actions">
              <button className={`action-btn${liked ? ' liked' : ''}`} onClick={toggleLike}>
                ❤️ {formatNum(likes[video.id] || 0)} Like
              </button>
              <button className="action-btn" onClick={shareVideo}>🔗 Share</button>
            </div>

            {/* Mobile related */}
            <div className="related-mobile">
              <div className="related-section-title">Related Videos</div>
              <div className="related-list">
                {related.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>No related videos</p>
                ) : related.map(v => (
                  <a key={v.id} className="related-card" href={`/video/${v.slug}`}>
                    <div className="related-thumb">
                      <img src={v.thumbnail} alt={v.title} loading="lazy" onError={e => { e.target.src = `https://picsum.photos/seed/${v.id}/320/180`; }} />
                    </div>
                    <div className="related-info">
                      <div className="related-title-text">{v.title}</div>
                      <div className="related-meta">👁 {formatNum(views[v.id] || 0)} · {v.category}</div>
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
                <a key={v.id} className="related-card" href={`/video/${v.slug}`}>
                  <div className="related-thumb">
                    <img src={v.thumbnail} alt={v.title} loading="lazy" onError={e => { e.target.src = `https://picsum.photos/seed/${v.id}/320/180`; }} />
                  </div>
                  <div className="related-info">
                    <div className="related-title-text">{v.title}</div>
                    <div className="related-meta">👁 {formatNum(views[v.id] || 0)} · {v.category}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
      }
