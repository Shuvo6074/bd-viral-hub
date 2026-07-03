import React, { useState, useEffect } from "react";
import Head from "next/head";

const SHEET_ID = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';
const PER_PAGE = 30;

// mbidadm ad script — page load এর ১৫ সেকেন্ড পর inject হবে
const AD_SCRIPT_SRC   = 'https://js.mbidadm.com/static/scripts.js';
const AD_SCRIPT_PID   = '446921';
const FIRST_SHOW_MS   = 15000; // পেজ লোডের ১৫ সেকেন্ড পর

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

const SHEET_ID_SSR = '1nHoGwVeoKe7p64ko6nkwWVY-svuonzBH936pbdv1t5A';

function slugifySSR(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

export async function getServerSideProps() {
  try {
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID_SSR}/gviz/tq?tqx=out:json`);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    const initialVideos = json.table.rows.map((row, i) => ({
      id: i,
      title:       row.c[0]?.v || 'Untitled',
      videoUrl:    row.c[1]?.v || '',
      thumbnail:   row.c[2]?.v || `https://picsum.photos/seed/${i}/640/360`,
      category:    row.c[3]?.v || 'General',
      date:        row.c[4]?.v || '',
      duration:    row.c[5]?.v || '',
      description: row.c[6]?.v || '',
      slug:        slugifySSR(row.c[0]?.v || 'video')
    })).filter(v => v.title !== 'Title').reverse();
    return { props: { initialVideos } };
  } catch(e) {
    return { props: { initialVideos: [] } };
  }
}

export default function Home({ initialVideos }) {
  const [allVideos, setAllVideos]   = useState(initialVideos);
  const [filtered, setFiltered]     = useState(initialVideos);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQ, setSearchQ]       = useState('');
  const [activeCat, setActiveCat]   = useState('all');
  const [cats, setCats]             = useState([...new Set(initialVideos.map(v => v.category))]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [views, setViews]           = useState({});

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem('vhub_views') || '{}');
      setViews(v);
    } catch(e) {}
  }, []);

  // ── Social Bar Ad inject — একবার inject, remove করা হবে না ──
  useEffect(() => {
    if (document.querySelector('script[src*="5c5fa829d1b2adb187a491231ec4716f"]')) return;
    const s = document.createElement('script');
    s.src = 'https://pl29731011.effectivecpmnetwork.com/5c/5f/a8/5c5fa829d1b2adb187a491231ec4716f.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // ── mbidadm ad script — ১৫ সেকেন্ড পর inject, একবারই ──
  useEffect(() => {
    const t = setTimeout(() => {
      if (document.querySelector(`script[src="${AD_SCRIPT_SRC}"]`)) return;
      const s = document.createElement('script');
      s.async = true;
      s.src = AD_SCRIPT_SRC;
      s.setAttribute('data-admpid', AD_SCRIPT_PID);
      document.body.appendChild(s);
    }, FIRST_SHOW_MS);

    return () => clearTimeout(t);
  }, []);

  // ── highperformanceformat.com banner ads inject ──
  useEffect(() => {
    const container = document.getElementById('ad-bottom-container');
    if (!container || container.dataset.loaded) return;
    container.dataset.loaded = 'true';

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
atOptions = {'key':'${key}','format':'iframe','height':${height},'width':${width},'params':{}};
</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/${key}/invoke.js"></script>
</body></html>`;
      iframe.srcdoc = html;
      return iframe;
    }

    const bannerWrap = document.createElement('div');
    bannerWrap.style.cssText = 'display:flex;justify-content:center;margin:1rem 0;';
    bannerWrap.appendChild(buildAdIframe('5adf6dca592b0a84d1333f77bd5c167c', 728, 90));
    container.appendChild(bannerWrap);

    const gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:1rem;margin:1rem 0;';
    const cell = document.createElement('div');
    cell.style.cssText = 'width:300px;height:250px;';
    cell.appendChild(buildAdIframe('408f7fe8d5566eee24a05d83101d2638', 300, 250));
    gridWrap.appendChild(cell);
    container.appendChild(gridWrap);
  }, [loading]);

  async function loadVideos() {
    try {
      const res  = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`);
      const text = await res.text();
      const json = JSON.parse(text.substring(47, text.length - 2));
      const videos = json.table.rows.map((row, i) => ({
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

      setCats([...new Set(videos.map(v => v.category))]);
      setAllVideos(videos);
      setFiltered(videos);
      setLoading(false);
    } catch(e) {
      setError(e.message);
      setLoading(false);
    }
  }

  function filterCat(cat) {
    setActiveCat(cat);
    setCurrentPage(1);
    const q = searchQ.toLowerCase();
    setFiltered(allVideos.filter(v =>
      (cat === 'all' || v.category === cat) &&
      (!q || v.title.toLowerCase().includes(q))
    ));
  }

  function handleSearch(q) {
    setSearchQ(q);
    setCurrentPage(1);
    setFiltered(allVideos.filter(v =>
      (activeCat === 'all' || v.category === activeCat) &&
      (!q || v.title.toLowerCase().includes(q.toLowerCase()))
    ));
  }

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  return (
    <>
      <Head>
        <title>BD Viral Hub | বাংলাদেশের সেরা ভাইরাল ভিডিও ২০২৬</title>
        <meta name="description" content="BD Viral Hub - বাংলাদেশের সেরা ভাইরাল ভিডিও সাইট। আজকের নতুন ভাইরাল ভিডিও লিংক, TikTok ভাইরাল ক্লিপ, Facebook Reels ভাইরাল, ফানি ভিডিও বিনামূল্যে দেখুন।" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow" />
        <meta name="rating" content="adult" />
        <meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
        <meta name="google-site-verification" content="uw9PPcSk-0iQ5QykqhGYmfYWjIcsOoIW-am1KsstBnQ" />
        <meta name="google-site-verification" content="NAhrexeitv2hKbCbtefH1LpUOR6kogUYUr5wDAZiyr8" />
        <meta name="msvalidate.01" content="86580AA48D4BA42EFA60D7A9803A6C5A" />
        <meta name="80c09c1226ae5c6e50661d42891c7f91cd1b8e1e" content="80c09c1226ae5c6e50661d42891c7f91cd1b8e1e" />
        <link rel="canonical" href="https://bd-viral-hub.vercel.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="BD Viral Hub | বাংলাদেশের সেরা ভাইরাল ভিডিও ২০২৬" />
        <meta property="og:description" content="বাংলাদেশের সেরা ভাইরাল ভিডিও সাইট। TikTok ভাইরাল, Facebook Reels ভাইরাল, ফানি ভিডিও ফ্রিতে দেখুন।" />
        <meta property="og:url" content="https://bd-viral-hub.vercel.app/" />
        <meta property="og:site_name" content="BD Viral Hub" />
        <meta property="og:locale" content="bn_BD" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context":"https://schema.org","@type":"WebSite","name":"BD Viral Hub",
          "url":"https://bd-viral-hub.vercel.app","description":"বাংলাদেশের সেরা ভাইরাল ভিডিও সাইট",
          "potentialAction":{"@type":"SearchAction","target":"https://bd-viral-hub.vercel.app/search?q={search_term_string}","query-input":"required name=search_term_string"}
        })}} />
        <style>{`
          :root{--bg:#0d0d0d;--surface:#181818;--surface2:#222;--accent:#ff3d3d;--text:#f5f5f5;--muted:#888;--border:#2a2a2a;--radius:10px;}
          *{margin:0;padding:0;box-sizing:border-box;}
          html,body{width:100%;max-width:100%;overflow-x:hidden;margin:0;padding:0;}
          body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;}
          header{background:#111;border-bottom:2px solid var(--accent);padding:0 2%;position:sticky;top:0;z-index:200;}
          .header-inner{max-width:1400px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:48px;gap:0.5rem;}
          .logo{font-family:'Bebas Neue',sans-serif;font-size:1.4rem;letter-spacing:2px;color:var(--text);text-decoration:none;cursor:pointer;white-space:nowrap;}
          .logo span{color:var(--accent);}
          .search-bar{flex:1;display:flex;min-width:0;}
          .search-bar input{flex:1;min-width:0;padding:0.4rem 0.75rem;background:var(--surface2);border:1px solid var(--border);border-right:none;border-radius:var(--radius) 0 0 var(--radius);color:var(--text);font-family:inherit;font-size:0.85rem;outline:none;}
          .search-bar button{padding:0.4rem 0.75rem;background:var(--accent);border:none;border-radius:0 var(--radius) var(--radius) 0;color:#fff;cursor:pointer;font-size:0.85rem;}
          .cat-tabs{display:flex;gap:0.4rem;overflow-x:auto;padding:0.4rem 2%;background:#111;border-bottom:1px solid var(--border);scrollbar-width:none;}
          .cat-tabs::-webkit-scrollbar{display:none;}
          .cat-tab{padding:0.25rem 0.75rem;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:0.78rem;font-weight:500;cursor:pointer;white-space:nowrap;transition:all 0.2s;}
          .cat-tab:hover,.cat-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}
          .main{width:100%;max-width:1400px;margin:0 auto;padding:0.5rem 0;}
          .section-title{font-family:'Bebas Neue',sans-serif;font-size:1.2rem;letter-spacing:1px;margin-bottom:0.5rem;padding:0.5rem 2%;color:var(--text);display:flex;align-items:center;gap:0.5rem;}
          .section-title::before{content:'';display:block;width:4px;height:1rem;background:var(--accent);border-radius:2px;}
          .video-grid{display:grid;grid-template-columns:1fr;gap:0;width:100%;}
          @media(min-width:480px){.video-grid{grid-template-columns:repeat(2,1fr);}}
          @media(min-width:768px){.video-grid{grid-template-columns:repeat(3,1fr);}}
          @media(min-width:1024px){.video-grid{grid-template-columns:repeat(4,1fr);}}
          @media(min-width:1400px){.video-grid{grid-template-columns:repeat(5,1fr);}}
          .video-card{background:var(--surface);overflow:hidden;cursor:pointer;transition:box-shadow 0.2s;border-bottom:1px solid var(--border);text-decoration:none;display:block;color:inherit;}
          .video-card:hover{box-shadow:0 4px 20px rgba(255,61,61,0.2);}
          .thumb-wrap{position:relative;width:100%;padding-top:56.25%;background:#000;overflow:hidden;}
          .thumb-wrap img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;transition:transform 0.3s;}
          .video-card:hover .thumb-wrap img{transform:scale(1.03);}
          .play-btn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);opacity:0;transition:opacity 0.2s;}
          .video-card:hover .play-btn{opacity:1;}
          .play-btn svg{width:48px;height:48px;}
          .duration-badge{position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.85);color:#fff;font-size:0.72rem;padding:2px 6px;border-radius:4px;font-weight:600;}
          .card-info{padding:0.75rem;}
          .card-title{font-size:0.9rem;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0.5rem;}
          .card-meta{display:flex;justify-content:space-between;font-size:0.75rem;color:var(--muted);}
          .cat-badge{background:rgba(255,61,61,0.15);color:var(--accent);font-size:0.7rem;padding:2px 8px;border-radius:10px;font-weight:600;}
          .pagination{display:flex;justify-content:center;align-items:center;gap:0.5rem;margin-top:2rem;padding:1rem 0;}
          .page-btn{padding:0.5rem 1.2rem;border-radius:var(--radius);background:var(--surface2);border:1px solid var(--border);color:var(--text);cursor:pointer;font-family:inherit;font-weight:600;transition:all 0.2s;}
          .page-btn:hover,.page-btn.active{background:var(--accent);border-color:var(--accent);color:#fff;}
          .page-btn:disabled{opacity:0.3;cursor:not-allowed;}
          .page-info{color:var(--muted);font-size:0.85rem;}
          .loading{text-align:center;padding:60px;color:var(--muted);}
          .spinner{width:36px;height:36px;margin:0 auto 1rem;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;}
          @keyframes spin{to{transform:rotate(360deg);}}
          .empty{text-align:center;padding:60px;color:var(--muted);}
          footer{background:#111;border-top:1px solid #222;padding:2rem 4%;margin-top:2rem;}
          footer .footer-inner{max-width:1400px;margin:0 auto;}
          footer h2{font-family:'Bebas Neue',sans-serif;color:var(--accent);font-size:1.2rem;margin-bottom:0.75rem;}
          footer h3{color:var(--text);font-size:0.95rem;margin-bottom:0.75rem;}
          footer p,footer li{color:#888;font-size:0.82rem;line-height:1.7;}
          footer ul{list-style:none;}
          footer .footer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;margin-bottom:1.5rem;}
          footer .footer-bottom{border-top:1px solid #222;padding-top:1rem;text-align:center;color:#555;font-size:0.78rem;}
          footer a{color:#666;text-decoration:none;}
          @media(max-width:768px){.search-bar{max-width:100%;}}
          body{padding-bottom:55px;}
          #adbox-5c5fa829d1b2adb187a491231ec4716f,
          div[id*="5c5fa829d1b2adb187a491231ec4716f"]{
            position:fixed !important;bottom:0 !important;top:auto !important;
            left:0 !important;width:100% !important;z-index:9999 !important;
          }
        `}</style>
      </Head>

      <header>
        <div className="header-inner">
          <a className="logo" href="/">BD Viral<span>Hub</span></a>
          <div className="search-bar">
            <input type="text" placeholder="ভিডিও খুঁজুন..." value={searchQ} onChange={e => handleSearch(e.target.value)} />
            <button>🔍</button>
          </div>
        </div>
      </header>

      <div className="cat-tabs">
        <span className={`cat-tab${activeCat === 'all' ? ' active' : ''}`} onClick={() => filterCat('all')}>🎬 All</span>
        {cats.map(cat => (
          <span key={cat} className={`cat-tab${activeCat === cat ? ' active' : ''}`} onClick={() => filterCat(cat)}>📁 {cat}</span>
        ))}
      </div>

      <div className="main">
        <div className="section-title">{activeCat === 'all' ? 'Latest Videos' : activeCat}</div>

        {loading && <div className="loading"><div className="spinner"></div><p>Loading videos...</p></div>}
        {error   && <div className="empty">❌ Could not load videos.<br /><small>{error}</small></div>}

        {!loading && !error && (
          <div className="video-grid">
            {paginated.length === 0 ? (
              <div className="empty">🎬 No videos found.</div>
            ) : paginated.map((v, i) => (
              <React.Fragment key={v.id}>
                <a className="video-card" href={`/video/${v.slug}`}>
                  <div className="thumb-wrap">
                    <img
                      src={v.thumbnail}
                      alt={`${v.title} - ভাইরাল ভিডিও বাংলাদেশ`}
                      loading={i < 6 ? 'eager' : 'lazy'}
                      onError={e => { e.target.src = `https://picsum.photos/seed/${v.id}/640/360`; }}
                    />
                    <div className="play-btn">
                      <svg viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="38" fill="rgba(255,61,61,0.9)" />
                        <polygon points="32,24 60,40 32,56" fill="white" />
                      </svg>
                    </div>
                    {v.duration && <span className="duration-badge">{v.duration}</span>}
                  </div>
                  <div className="card-info">
                    <div className="card-title">{v.title}</div>
                    <div className="card-meta">
                      <span className="cat-badge">{v.category}</span>
                      <span>👁 {formatNum(views[v.id] || 0)}</span>
                    </div>
                  </div>
                </a>
                {(i + 1) % 15 === 0 && (
                  <div
                    style={{gridColumn:'1/-1',margin:'1.5rem 0',padding:'0.5rem 0',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'center',minHeight:'100px'}}
                    ref={el => {
                      if (!el || el.dataset.loaded) return;
                      el.dataset.loaded = 'true';
                      const containerId = `container-e3988ef0a3824ff9822566414d9bbdff`;
                      const d = document.createElement('div');
                      d.id = containerId;
                      el.appendChild(d);
                      const s = document.createElement('script');
                      s.async = true;
                      s.setAttribute('data-cfasync', 'false');
                      s.src = 'https://pl29731012.effectivecpmnetwork.com/e3988ef0a3824ff9822566414d9bbdff/invoke.js';
                      el.appendChild(s);
                    }}
                  ></div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(i => {
              if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1)
                return <button key={i} className={`page-btn${i === currentPage ? ' active' : ''}`} onClick={() => { setCurrentPage(i); window.scrollTo(0,0); }}>{i}</button>;
              else if (Math.abs(i - currentPage) === 2)
                return <span key={i} className="page-info">...</span>;
              return null;
            })}
            <button className="page-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages}>Next →</button>
          </div>
        )}

        <div id="ad-bottom-container"></div>
      </div>

      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <h2>BD Viral Hub</h2>
              <p>বাংলাদেশের সেরা ভাইরাল ভিডিও প্ল্যাটফর্ম। প্রতিদিন নতুন TikTok ভাইরাল ক্লিপ, Facebook Reels ভাইরাল, ফানি ভিডিও বিনামূল্যে দেখুন।</p>
            </div>
            <div>
              <h3>ভিডিও ক্যাটাগরি</h3>
              <ul>
                <li>🎬 ভাইরাল ভিডিও বাংলাদেশ</li>
                <li>📱 TikTok ভাইরাল ক্লিপ ২০২৬</li>
                <li>😂 ফানি ভিডিও বাংলাদেশ</li>
                <li>🆕 আজকের নতুন ভাইরাল ভিডিও</li>
                <li>📘 Facebook Reels ভাইরাল BD</li>
              </ul>
            </div>
            <div>
              <h3>জনপ্রিয় সার্চ</h3>
              <ul>
                <li><a href="/search?q=tiktok+viral">🔥 TikTok Viral BD 2026</a></li>
                <li><a href="/search?q=funny+video">😂 Funny Video Bangladesh</a></li>
                <li><a href="/search?q=facebook+reels">📘 Facebook Reels Viral BD</a></li>
                <li><a href="/search?q=new+viral">🆕 New Viral Video Today BD</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 BD Viral Hub | বাংলাদেশের সেরা ভাইরাল ভিডিও সাইট</p>
          </div>
        </div>
      </footer>
    </>
  );
    }
