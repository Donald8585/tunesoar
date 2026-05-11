const fs = require('fs');

// Read pages.ts
const source = fs.readFileSync('landing/pages.ts', 'utf8');

// Extract LAYOUT_CSS, NAV_LOGO, and layout function
// Then extract HOME_PAGE and DOWNLOAD_PAGE

const LAYOUT_CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e4e4ec;min-height:100vh;line-height:1.6}
nav{display:flex;align-items:center;justify-content:space-between;max-width:960px;margin:0 auto;padding:16px 24px}
nav a{color:#8a8a9a;text-decoration:none;font-size:.88rem;margin-left:24px;transition:color .15s}
nav a:hover{color:#fff}
nav a.active{color:#c4b5ff}
nav .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.05rem;color:#fff;text-decoration:none}
nav .brand svg{width:28px;height:auto}
main{max-width:960px;margin:0 auto;padding:0 24px 80px}
h1{font-size:2rem;margin-bottom:16px;background:linear-gradient(135deg,#863bff,#47bfff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
h2{font-size:1.35rem;color:#c4b5ff;margin:32px 0 12px}
h3{font-size:1.05rem;color:#aaa;margin-bottom:8px}
p{color:#8a8a9a;margin-bottom:12px}
code{background:#12121a;border:1px solid #2a2a3a;border-radius:6px;padding:2px 6px;font-size:.85rem}
pre{background:#12121a;border:1px solid #2a2a3a;border-radius:10px;padding:16px;overflow-x:auto;margin:12px 0;font-size:.82rem}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;font-size:.9rem;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:1px solid #2a2a3a;background:#12121a;color:#c4c4d4}
.btn:hover{background:#1a1a28;border-color:#4747ff;color:#fff}
.btn.primary{background:linear-gradient(135deg,#6b21ff,#4747ff);border-color:transparent;color:#fff}
.btn.primary:hover{opacity:.85}
.btn.ghost{background:transparent;border-color:transparent;color:#8a8a9a}
.btn.ghost:hover{color:#fff;background:rgba(255,255,255,.04)}
.card{background:#12121a;border:1px solid #2a2a3a;border-radius:12px;padding:24px;margin-bottom:16px}
.card h3{margin-top:0}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:24px 0}
.pricing-card{text-align:center;position:relative}
.pricing-card .price{font-size:2.2rem;font-weight:800;color:#fff;margin:12px 0 4px}
.pricing-card .period{font-size:.82rem;color:#8a8a9a}
.pricing-card ul{list-style:none;text-align:left;margin:20px 0;padding:0}
.pricing-card li{padding:6px 0;font-size:.88rem;color:#8a8a9a;border-bottom:1px solid #1a1a2a}
.pricing-card li:before{content:"✓ ";color:#47bfff}
.pricing-card.featured{border-color:#6b21ff;background:linear-gradient(180deg,#1a1030,#12121a)}
.pricing-card.featured:after{content:"Popular";position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6b21ff;color:#fff;padding:4px 14px;border-radius:20px;font-size:.75rem;font-weight:600}
.nav-right{display:flex;align-items:center;gap:8px}
.footer{text-align:center;padding:32px 24px;font-size:.78rem;color:#555;border-top:1px solid #1a1a2a;max-width:960px;margin:0 auto}
.footer a{color:#555;text-decoration:none;margin:0 8px}
.footer a:hover{color:#8a8a9a}`;

// Extract exports using eval (pages.ts uses export const = layout(...))
const moduleExports = {};
// We need to eval the file - let's just extract the relevant parts
// The file structure is: const LAYOUT_CSS, NAV_LOGO, function layout, export const HOME_PAGE, export const DOWNLOAD_PAGE

// Extract DOWNLOAD_PAGE content from source (around line 88+)
const dlMatch = source.match(/export const DOWNLOAD_PAGE = layout\("Download", `([\s\S]*?)`, "\/downloads"\)/);
if (dlMatch) {
  const dlBody = dlMatch[1];
  console.log('Found DOWNLOAD_PAGE body');
  console.log('Length:', dlBody.length);
} else {
  console.log('DID NOT MATCH DOWNLOAD_PAGE');
}
