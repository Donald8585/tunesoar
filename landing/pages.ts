const LAYOUT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
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
.footer a:hover{color:#8a8a9a}
`;

const NAV_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 512 512" style="width:28px;height:auto"><path d="M126 296 Q176 216 236 236 Q296 256 246 286 Q196 316 146 276" stroke="url(#w1n)" stroke-width="10" stroke-linecap="round"/><linearGradient id="w1n" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6b21ff"/><stop offset="100%" stop-color="#47bfff"/></linearGradient><linearGradient id="w2n" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#47bfff"/><stop offset="100%" stop-color="#6b21ff"/></linearGradient><linearGradient id="dotn" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#47bfff"/><stop offset="100%" stop-color="#863bff"/></linearGradient><circle cx="266" cy="266" r="34" fill="url(#dotn)"/><circle cx="266" cy="266" r="12" fill="#fff" opacity="0.9"/><path d="M326 216 Q376 176 406 206 Q436 236 386 266" stroke="url(#w2n)" stroke-width="7" stroke-linecap="round"/><circle cx="430" cy="310" r="9" fill="#863bff" opacity="0.4"/></svg>`;

function layout(title: string, body: string, currentPage = ""): string {
  const navLink = (href: string, label: string) =>
    `<a href="${href}"${currentPage === href ? ' class="active"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — TuneSoar</title>
<style>${LAYOUT_CSS}</style>
<script async crossorigin src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  data-clerk-publishable-key="pk_live_Y2xlcmsudHVuZXNvYXIuY29tJA"
  data-clerk-sign-in-url="/account"
  data-clerk-sign-up-url="/account">
</script>
</head>
<body>
<nav>
  <a href="/" class="brand">${NAV_LOGO}TuneSoar</a>
  <div class="nav-right">
    ${navLink("/", "Home")}
    ${navLink("/pricing", "Pricing")}
    ${navLink("/account", "Account")}
  </div>
</nav>
<main>${body}</main>
<footer class="footer">
  <a href="/privacy">Privacy</a> &middot; 
  <a href="/terms">Terms</a> &middot; 
  <a href="/safety">Safety</a> &middot; 
  © TranceLab
</footer>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────────────

export const HOME_PAGE = layout("Context-Aware Binaural Beats", `
<div style="text-align:center;padding:80px 0 40px">
