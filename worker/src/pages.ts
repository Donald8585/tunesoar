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

const NAV_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style="width:28px;height:auto"><defs><linearGradient id="nl" x1="0" y1="12" x2="24" y2="12" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#60a5fa"/></linearGradient></defs><rect x="2" y="8" width="2" height="8" rx="1" fill="url(#nl)" opacity=".6"/><rect x="5.5" y="5.5" width="2" height="13" rx="1" fill="url(#nl)" opacity=".8"/><rect x="9" y="3" width="2" height="18" rx="1" fill="url(#nl)"/><circle cx="13" cy="12" r="4.5" fill="url(#nl)"/><circle cx="13" cy="12" r="2" fill="#fff" opacity=".85"/><rect x="19" y="3" width="2" height="18" rx="1" fill="url(#nl)"/><rect x="22.5" y="5.5" width="2" height="13" rx="1" fill="url(#nl)" opacity=".8"/></svg>`;

function layout(title: string, body: string, currentPage = ""): string {
  const navLink = (href: string, label: string) =>
    `<a href="${href}"${currentPage === href ? ' class="active"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAiIHkxPSIwIiB4Mj0iMSIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjOGI1Y2Y2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzNiODJmNiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNCIgZmlsbD0iIzFhMTA0MCIvPgogIDwhLS0gTGFyZ2UgYm9sZCBiYXJzIC0tPgogIDxyZWN0IHg9IjE4IiB5PSI0NiIgd2lkdGg9IjgiIGhlaWdodD0iMzYiIHJ4PSI0IiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIuNyIvPgogIDxyZWN0IHg9IjMyIiB5PSIzMiIgd2lkdGg9IjgiIGhlaWdodD0iNjQiIHJ4PSI0IiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3QgeD0iNDYiIHk9IjIyIiB3aWR0aD0iOCIgaGVpZ2h0PSI4NCIgcng9IjQiIGZpbGw9InVybCgjZykiLz4KICA8IS0tIENlbnRlciAtLT4KICA8Y2lyY2xlIGN4PSI3MiIgY3k9IjY0IiByPSIyNiIgZmlsbD0idXJsKCNnKSIvPgogIDxjaXJjbGUgY3g9IjcyIiBjeT0iNjQiIHI9IjExIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuOTUiLz4KICA8IS0tIFJpZ2h0IGJhcnMgLS0+CiAgPHJlY3QgeD0iMTA0IiB5PSIyMiIgd2lkdGg9IjgiIGhlaWdodD0iODQiIHJ4PSI0IiBmaWxsPSJ1cmwoI2cpIi8+CiAgPHJlY3QgeD0iMTE4IiB5PSIzMiIgd2lkdGg9IjgiIGhlaWdodD0iNjQiIHJ4PSI0IiBmaWxsPSJ1cmwoI2cpIiBvcGFjaXR5PSIuNyIvPgo8L3N2Zz4K"/>
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
    ${navLink("/downloads", "Downloads")}
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
<h1>Context-Aware Binaural Beats</h1>
<p>Automatically switches binaural beat profiles based on what you're doing.</p>
<a href="/downloads" class="btn primary" style="margin-top:16px">Download for Free</a>
</div>
`);

// ────────────────────────────────────────────────────────────────────

export const DOWNLOAD_PAGE = layout("Download", `
<div style="padding:80px 0 40px;text-align:center">
<h1>Download TuneSoar</h1>
<p>Choose your platform below. All versions auto-update.<br><span style="font-size:.78rem;color:#555">Downloads served via Cloudflare CDN ⚡</span></p>
</div>

<div id="dl-root" style="margin-top:32px">
  <div style="text-align:center;padding:48px">
    <p>Loading latest release…</p>
  </div>
</div>

<script>
(function(){
  var CDN = "https://tunesoar.com/releases/download";
  var root = document.getElementById("dl-root");

  // Asset catalog — serves as fallback + sizes
  var CATALOG = {
    windows: [
      {name:"TuneSoar_0.1.0_x64-setup.exe",label:"Windows Installer (.exe)",size:2.4},
      {name:"TuneSoar_0.1.0_x64_en-US.msi",label:"Windows MSI",size:3.3}
    ],
    mac: [
      {name:"TuneSoar_0.1.0_aarch64.dmg",label:"macOS Apple Silicon (.dmg)",size:3.5},
      {name:"TuneSoar_0.1.0_x64.dmg",label:"macOS Intel (.dmg)",size:3.7}
    ],
    linux: [
      {name:"TuneSoar_0.1.0_amd64.deb",label:"Linux .deb",size:3.6},
      {name:"TuneSoar_0.1.0_amd64.AppImage",label:"Linux AppImage",size:79.6},
      {name:"TuneSoar-0.1.0-1.x86_64.rpm",label:"Linux .rpm",size:3.6}
    ]
  };

  function detectOS() {
    var ua = navigator.userAgent;
    if (/Mac/i.test(ua)) {
      try { return navigator.userAgentData.platform && /arm|aarch64/i.test(navigator.userAgentData.platform) ? "mac-arm" : "mac-intel"; }
      catch(e) { return "mac-intel"; }
    }
    if (/Windows/i.test(ua)) return "windows";
    if (/Linux/i.test(ua) || /X11/i.test(ua)) return "linux";
    return "unknown";
  }

  var osLabels = {
    "mac-arm": "Download for Mac (Apple Silicon)",
    "mac-intel": "Download for Mac (Intel)",
    "windows": "Download for Windows",
    "linux": "Download for Linux",
    "unknown": "View all downloads"
  };

  var os = detectOS();

  // Try to fetch latest version from updater API
  fetch("https://api.tunesoar.com/releases/updater/windows-x86_64/x86_64/0.0.0")
    .then(function(r) { return r.json(); })
    .then(function(manifest) {
      var tag = (manifest.version||"0.1.0");
      var html = "";

      // Pick best download for detected OS
      var primaryFile = null;
      if (os === "windows") primaryFile = CATALOG.windows[0];
      else if (os === "mac-intel") primaryFile = CATALOG.mac[1];
      else if (os === "mac-arm") primaryFile = CATALOG.mac[0];
      else if (os === "linux") primaryFile = CATALOG.linux[0];

      if (primaryFile) {
        html += '<div style="text-align:center;margin-bottom:48px">';
        html += '<a href="'+CDN+'/'+primaryFile.name+'" class="btn primary" style="font-size:1.1rem;padding:14px 32px">';
        html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ';
        html += osLabels[os] + " — " + tag;
        html += '</a>';
        html += '<p style="margin-top:8px;font-size:.82rem;color:#555">' + primaryFile.size.toFixed(1) + ' MB · Served via Cloudflare CDN ⚡</p>';
        html += '</div>';
      }

      // All platforms grid
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">';
      var groups = {"🪟 Windows":CATALOG.windows,"🍎 macOS":CATALOG.mac,"🐧 Linux":CATALOG.linux};
      Object.keys(groups).forEach(function(label) {
        html += '<div class="card"><h3>'+label+'</h3>';
        groups[label].forEach(function(a) {
          html += '<a href="'+CDN+'/'+a.name+'" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-radius:8px;text-decoration:none;color:#c4c4d4;border:1px solid #1a1a2a;margin-bottom:8px;transition:all .15s" onmouseover="this.style.borderColor=\'#4747ff\';this.style.color=\'#fff\'" onmouseout="this.style.borderColor=\'#1a1a2a\';this.style.color=\'#c4c4d4\'">';
          html += '<span style="font-size:.85rem;font-family:monospace">'+a.label+'</span>';
          html += '<span style="font-size:.75rem;color:#555">'+a.size.toFixed(1)+' MB</span>';
          html += '</a>';
        });
        html += '</div>';
      });
      html += '</div>';

      // One-liner installers
      html += '<div style="margin-top:48px;text-align:center">';
      html += '<h2>One-liner install</h2>';
      html += '<p style="margin-bottom:24px">Paste into your terminal:</p>';
      html += '<pre style="text-align:left;max-width:560px;margin:0 auto 12px">curl -fsSL https://tunesoar.com/install.sh | bash</pre>';
      html += '<p style="font-size:.78rem">or on Windows PowerShell:</p>';
      html += '<pre style="text-align:left;max-width:560px;margin:0 auto">irm https://tunesoar.com/install.ps1 | iex</pre>';
      html += '</div>';

      root.innerHTML = html;
    })
    .catch(function() {
      // Fallback: show static links
      var html = '<div style="text-align:center;margin-bottom:48px"><a href="'+CDN+'/TuneSoar_0.1.0_x64-setup.exe" class="btn primary" style="font-size:1.1rem;padding:14px 32px">Download for Windows</a></div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">';
      var groups = {"🪟 Windows":CATALOG.windows,"🍎 macOS":CATALOG.mac,"🐧 Linux":CATALOG.linux};
      Object.keys(groups).forEach(function(label) {
        html += '<div class="card"><h3>'+label+'</h3>';
        groups[label].forEach(function(a) {
          html += '<a href="'+CDN+'/'+a.name+'" class="btn" style="width:100%;text-align:left;margin-bottom:8px">'+a.label+' · '+a.size.toFixed(1)+' MB</a>';
        });
        html += '</div>';
      });
      html += '</div>';
      root.innerHTML = html;
    });
})();
</script>

<div style="text-align:center;margin-top:32px;padding:24px;background:#12121a;border:1px solid #2a2a3a;border-radius:12px;max-width:600px;margin-left:auto;margin-right:auto">
  <h3 style="margin-top:0">Direct Downloads — v0.1.0</h3>
  <div style="display:flex;flex-direction:column;gap:10px;text-align:left">
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_x64-setup.exe" class="btn" style="display:flex;justify-content:space-between"><span>🪟 Windows Installer</span><span style="color:#555">2.4 MB</span></a>
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_x64_en-US.msi" class="btn" style="display:flex;justify-content:space-between"><span>🪟 Windows MSI</span><span style="color:#555">3.3 MB</span></a>
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_aarch64.dmg" class="btn" style="display:flex;justify-content:space-between"><span>🍎 macOS (Apple Silicon M1/M2/M3)</span><span style="color:#555">3.5 MB</span></a>
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_x64.dmg" class="btn" style="display:flex;justify-content:space-between"><span>🍎 macOS (Intel)</span><span style="color:#555">3.7 MB</span></a>
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_amd64.deb" class="btn" style="display:flex;justify-content:space-between"><span>🐧 Linux .deb</span><span style="color:#555">3.6 MB</span></a>
    <a href="https://tunesoar.com/releases/download/TuneSoar_0.1.0_amd64.AppImage" class="btn" style="display:flex;justify-content:space-between"><span>🐧 Linux AppImage</span><span style="color:#555">79.6 MB</span></a>
  </div>
  <p style="margin-top:16px;font-size:.78rem;color:#555">⚠️ macOS builds are ad-hoc signed — Right-click → Open on first launch</p>
</div>

`, "/downloads");

// ────────────────────────────────────────────────────────────────────

export const PRICING_PAGE = layout("Pricing", `
<div style="padding:80px 0 40px;text-align:center">
<h1>Pricing</h1>
<p>Simple, transparent pricing for TuneSoar.</p>
</div>
<div class="pricing-grid" style="max-width:720px;margin:0 auto">
<div class="pricing-card">
<div class="price">Free</div>
<div class="period">forever</div>
<ul>
<li>All binaural beat profiles</li>
<li>Auto context detection</li>
<li>System tray mode</li>
<li>Basic support</li>
</ul>
<a href="/downloads" class="btn" style="width:100%;text-align:center;justify-content:center">Get Started</a>
</div>
<div class="pricing-card featured">
<div class="price">$4.99</div>
<div class="period">/ month</div>
<ul>
<li>Everything in Free</li>
<li>Custom beat profiles</li>
<li>Priority support</li>
<li>Early access features</li>
</ul>
<a href="/account" class="btn primary" style="width:100%;text-align:center;justify-content:center">Subscribe</a>
</div>
<div class="pricing-card">
<div class="price">$49</div>
<div class="period">lifetime</div>
<ul>
<li>Everything in Monthly</li>
<li>Lifetime access</li>
<li>All future updates</li>
<li>Vote on roadmap</li>
</ul>
<a href="/account" class="btn" style="width:100%;text-align:center;justify-content:center">Buy Once</a>
</div>
</div>
`, "/pricing");

// ────────────────────────────────────────────────────────────────────

export const ACCOUNT_PAGE = layout("Account", `
<div style="padding:80px 0 40px;text-align:center">
<h1>Account</h1>
<p>Sign in to manage your license and subscription.</p>
</div>
<div id="clerk-root" style="max-width:400px;margin:0 auto"></div>
<script>
(function(){
  if(window.Clerk){
    Clerk.mountSignIn(document.getElementById("clerk-root"),{
      afterSignInUrl:"/account",
      afterSignUpUrl:"/account"
    });
  }
})();
</script>
`, "/account");

// ────────────────────────────────────────────────────────────────────

export const PRIVACY_PAGE = layout("Privacy Policy", `
<div style="padding:80px 0 40px">
<h1>Privacy Policy</h1>
<p>Last updated: May 2026</p>
<div class="card">
<h3>Data Collection</h3>
<p>TuneSoar does not collect personal data. The app runs entirely on your device. The only data transmitted is:</p>
<ul style="padding-left:20px;color:#8a8a9a">
<li>Anonymous update checks (version number only)</li>
<li>License verification (if you have a paid plan)</li>
</ul>
</div>
<div class="card">
<h3>Third-Party Services</h3>
<p>We use Clerk for authentication (account page only) and Stripe for payment processing. Their respective privacy policies apply when you interact with those services.</p>
</div>
<div class="card">
<h3>Contact</h3>
<p>Questions? Reach out at fiverrkroft@gmail.com</p>
</div>
</div>
`, "/privacy");

// ────────────────────────────────────────────────────────────────────

export const TERMS_PAGE = layout("Terms of Service", `
<div style="padding:80px 0 40px">
<h1>Terms of Service</h1>
<p>Last updated: May 2026</p>
<div class="card">
<h3>License</h3>
<p>TuneSoar is provided as-is. The free version is for personal use. Paid plans grant additional features as described on the pricing page.</p>
</div>
<div class="card">
<h3>Refunds</h3>
<p>Monthly subscriptions can be cancelled anytime. Lifetime purchases are final. Contact us if you have issues.</p>
</div>
<div class="card">
<h3>Limitation of Liability</h3>
<p>TranceLab is not liable for any damages arising from the use of TuneSoar. The app provides audio entertainment and is not a medical device.</p>
</div>
</div>
`, "/terms");

// ────────────────────────────────────────────────────────────────────

export const SAFETY_PAGE = layout("Safety", `
<div style="padding:80px 0 40px">
<h1>Safety Information</h1>
<div class="card">
<h3>⚠️ Important</h3>
<p>Binaural beats may affect brainwave activity. Please read the following before using TuneSoar.</p>
</div>
<div class="card">
<h3>Who Should Avoid</h3>
<ul style="padding-left:20px;color:#8a8a9a">
<li>People with epilepsy or seizure disorders</li>
<li>People with pacemakers or other implanted medical devices</li>
<li>People prone to photosensitive reactions</li>
<li>Children under 13 without supervision</li>
</ul>
</div>
<div class="card">
<h3>Safe Use Guidelines</h3>
<ul style="padding-left:20px;color:#8a8a9a">
<li>Keep volume at a comfortable level</li>
<li>Take breaks every 60 minutes</li>
<li>Do not use while operating heavy machinery</li>
<li>Stop use if you experience discomfort or headaches</li>
</ul>
</div>
<div class="card">
<h3>Medical Disclaimer</h3>
<p>TuneSoar is an entertainment and productivity tool. It is not a medical device and is not intended to diagnose, treat, cure, or prevent any condition. Consult a healthcare professional for medical advice.</p>
</div>
</div>
`, "/safety");

