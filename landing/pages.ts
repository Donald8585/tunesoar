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

const NAV_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 46"><path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>`;

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

const HOME_PAGE = layout("Context-Aware Binaural Beats", `
<div style="text-align:center;padding:80px 0 40px">
  <svg style="width:80px;height:auto;margin-bottom:24px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 46"><path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>
  <h1>TuneSoar</h1>
  <p style="font-size:1.15rem;max-width:520px;margin:0 auto 32px;line-height:1.7">
    Context-aware binaural beats that auto-deploy based on what you're doing.<br>
    Coding → Beta waves. Writing → Alpha. Gaming → Focus. Zero manual switching.
  </p>
  <a class="btn primary" href="/releases/latest/windows/x64" style="font-size:1.05rem;padding:14px 32px">⬇ Download for Windows</a>
  <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
    <a class="btn" href="/releases/latest/macos/arm64">🍎 macOS</a>
    <a class="btn" href="/releases/latest/linux/x64">🐧 Linux</a>
  </div>
  <details style="margin-top:24px;text-align:left;max-width:520px;margin-left:auto;margin-right:auto">
    <summary style="cursor:pointer;color:#8a8afa;font-size:.85rem">Or use the one-liner</summary>
    <p style="color:#8a8a9a;font-size:.78rem;margin:12px 0 4px">macOS / Linux:</p>
    <pre><code>curl -fsSL https://tunesoar.com/install.sh | bash</code></pre>
    <p style="color:#8a8a9a;font-size:.78rem;margin:12px 0 4px">Windows (PowerShell):</p>
    <pre><code>irm https://tunesoar.com/install.ps1 | iex</code></pre>
  </details>
</div>

<div class="card">
  <h3>🎯 How It Works</h3>
  <p>TuneSoar watches your active window title / app name. It maps your activity to a brainwave profile and plays the right binaural beat — automatically crossfading between states with zero clicks.</p>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:16px 0">
  <div class="card"><h3>🧠 12 Contexts</h3><p>Coding, Writing, Gaming, Reading, Design, Relax, Focus, Learning, Meeting, Music, Social, Sleep</p></div>
  <div class="card"><h3>🎵 5 Brainwave Bands</h3><p>Delta (sleep) · Theta (deep relax) · Alpha (calm focus) · Beta (active) · Gamma (peak)</p></div>
  <div class="card"><h3>🔇 Auto-Pause</h3><p>Pauses during meetings, music playback, or idle. Resumes when you're back.</p></div>
  <div class="card"><h3>🌙 Sleep Mode</h3><p>Auto-switches to Delta beats at bedtime. Wakes up when you do.</p></div>
</div>
`, "/");

// ────────────────────────────────────────────────────────────────────

const PRICING_PAGE = layout("Pricing", `
<div style="text-align:center;padding:60px 0 20px"><h1>Simple Pricing</h1><p>Start free. Upgrade when you're ready.</p></div>
<div class="pricing-grid">
  <div class="card pricing-card">
    <h3>Free</h3>
    <div class="price">$0</div>
    <div class="period">forever</div>
    <ul>
      <li>5 context types</li>
      <li>3 beat profiles</li>
      <li>Default mappings</li>
      <li>Basic crossfade</li>
      <li>System tray interface</li>
      <li>Safety volume cap</li>
    </ul>
    <a class="btn" href="/releases/latest/windows/x64">Download Free</a>
  </div>
  <div class="card pricing-card featured">
    <h3>Pro Monthly</h3>
    <div class="price">$6.99</div>
    <div class="period">per month</div>
    <ul>
      <li>All 12 context types</li>
      <li>All 5 beat profiles</li>
      <li>Custom context mappings</li>
      <li>Sleep mode</li>
      <li>Browser extension</li>
      <li>Priority support</li>
      <li>2s crossfade engine</li>
    </ul>
    <a class="btn primary" href="/account">Get Pro →</a>
  </div>
  <div class="card pricing-card">
    <h3>Lifetime</h3>
    <div class="price">$89</div>
    <div class="period">one-time</div>
    <ul>
      <li>All Pro features</li>
      <li>No recurring fees</li>
      <li>Lifetime updates</li>
      <li>3 device licenses</li>
      <li>Early access to new features</li>
      <li>Everything, forever</li>
    </ul>
    <a class="btn primary" href="/account">Go Lifetime →</a>
  </div>
</div>
<p style="text-align:center;margin-top:24px;color:#8a8a9a">All purchases protected by Stripe. Cancel anytime. Volume hard-capped at 25% for safety.</p>
`, "/pricing");

// ────────────────────────────────────────────────────────────────────

const ACCOUNT_PAGE = layout("Account", `
<div style="text-align:center;padding:60px 0 20px"><h1>Account</h1></div>
<div class="card" style="max-width:480px;margin:0 auto;text-align:center">
  <div id="clerk-signed-out" style="display:none">
    <p style="margin-bottom:16px">Sign in to manage your license, devices, and subscription.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a class="btn primary" href="https://accounts.tunesoar.com/sign-in?redirect_url=https://tunesoar.com/account">Sign In</a>
      <a class="btn" href="https://accounts.tunesoar.com/sign-up?redirect_url=https://tunesoar.com/account">Create Account</a>
    </div>
    <p style="margin-top:24px;font-size:.82rem;color:#8a8a9a">
      Don't have an account? <a href="https://accounts.tunesoar.com/sign-up" style="color:#8a8afa">Sign up</a> in seconds.
    </p>
  </div>
  <div id="clerk-signed-in" style="display:none">
    <div style="margin-bottom:20px" id="clerk-user-button"></div>
    <p style="margin-bottom:8px">You're signed in. Manage your profile, devices, and billing below.</p>
    <div style="display:flex;gap:12px;justify-content:center;margin-top:20px">
      <a class="btn" href="https://accounts.tunesoar.com/user" target="_blank">Manage Account</a>
      <button class="btn ghost" id="clerk-sign-out-btn">Sign Out</button>
    </div>
  </div>
</div>
<script>
(async()=>{await window.Clerk?.load();const s=document.getElementById("clerk-signed-in"),o=document.getElementById("clerk-signed-out");
if(window.Clerk?.user){s.style.display="block";o.style.display="none";
const d=document.getElementById("clerk-user-button");window.Clerk.mountUserButton(d)}
else{s.style.display="none";o.style.display="block"}
document.getElementById("clerk-sign-out-btn")?.addEventListener("click",async()=>{await window.Clerk?.signOut();location.reload()})})();
</script>
`, "/account");

// ────────────────────────────────────────────────────────────────────

const PRIVACY_PAGE = layout("Privacy Policy", `
<div style="padding:60px 0 20px"><h1>Privacy Policy</h1></div>
<div class="card" style="max-width:720px;margin:0 auto">
  <p><strong>Last updated:</strong> May 2026</p>
  <h2>1. Data We Collect</h2>
  <p>TuneSoar runs locally on your device. We do not upload or transmit your active window titles, app names, or browsing activity to any server. Window detection happens entirely on-device.</p>
  <p>When you create an account or purchase a license, we store:</p>
  <ul style="color:#8a8a9a;padding-left:20px;margin-bottom:12px"><li>Email address (via Clerk)</li><li>License key and activation status</li><li>Device fingerprints (hashed, never raw)</li><li>Payment records (processed by Stripe — we never see full card details)</li></ul>
  <h2>2. How We Use Data</h2>
  <p>Account data is used solely for license verification and payment processing. We do not sell, share, or analyze your data for advertising or profiling.</p>
  <h2>3. Third Parties</h2>
  <p><strong>Clerk</strong> — authentication and user management. <a href="https://clerk.com/legal/privacy" style="color:#8a8afa">Clerk Privacy Policy</a>.</p>
  <p><strong>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" style="color:#8a8afa">Stripe Privacy Policy</a>.</p>
  <p><strong>Cloudflare</strong> — hosting and DNS. <a href="https://www.cloudflare.com/privacypolicy/" style="color:#8a8afa">Cloudflare Privacy Policy</a>.</p>
  <h2>4. Your Rights</h2>
  <p>You may request deletion of your account and associated data at any time by contacting us. Upon license verification, device fingerprints are hashed with a secret salt — they cannot be reversed to identify your device.</p>
  <h2>5. Contact</h2>
  <p>Email: <a href="mailto:fiverrkroft@gmail.com" style="color:#8a8afa">fiverrkroft@gmail.com</a></p>
</div>
`, "/privacy");

// ────────────────────────────────────────────────────────────────────

const TERMS_PAGE = layout("Terms of Service", `
<div style="padding:60px 0 20px"><h1>Terms of Service</h1></div>
<div class="card" style="max-width:720px;margin:0 auto">
  <p><strong>Last updated:</strong> May 2026</p>
  <h2>1. Acceptance</h2>
  <p>By using TuneSoar, you agree to these terms. If you do not agree, do not use the software.</p>
  <h2>2. License</h2>
  <p>TuneSoar is licensed, not sold. Your license grants you non-exclusive, non-transferable use of the software on up to 3 devices (Pro/Lifetime) or 1 device (Free).</p>
  <h2>3. Safety Acknowledgment</h2>
  <p><strong>Binaural beats may trigger seizures in people with photosensitive epilepsy.</strong> You must read and acknowledge the Safety Warning before first use. Do not use if you have a history of seizures. Consult a doctor before use. Start at low volume (&lt;10%). Stop immediately if you feel discomfort.</p>
  <h2>4. Payments & Refunds</h2>
  <p>Payments are processed by Stripe. Monthly subscriptions auto-renew until cancelled. You may cancel anytime from your Account page. Refund requests are handled on a case-by-case basis — contact us within 14 days of purchase.</p>
  <h2>5. Limitation of Liability</h2>
  <p>TuneSoar is provided "as is" without warranty. TranceLab is not liable for any damages arising from use of the software, including but not limited to hearing damage, seizures, or data loss. Use at your own risk.</p>
  <h2>6. Termination</h2>
  <p>We reserve the right to terminate licenses for violation of these terms or abuse of the service.</p>
  <h2>7. Contact</h2>
  <p>Email: <a href="mailto:fiverrkroft@gmail.com" style="color:#8a8afa">fiverrkroft@gmail.com</a></p>
</div>
`, "/terms");

// ────────────────────────────────────────────────────────────────────

const SAFETY_PAGE = layout("⚠️ Safety Warning", `
<div style="padding:60px 0 20px"><h1>⚠️ Safety Warning</h1></div>
<div class="card" style="max-width:720px;margin:0 auto;border-color:#ff6b47">
  <h3 style="color:#ff6b47">Binaural beats may trigger seizures in people with photosensitive epilepsy.</h3>
  <h2>Before Using TuneSoar:</h2>
  <ul style="color:#8a8a9a;padding-left:20px">
    <li style="margin-bottom:8px">⚠️ <strong>Do not use</strong> if you have a history of seizures or epilepsy</li>
    <li style="margin-bottom:8px">🩺 <strong>Consult a doctor</strong> before use, especially if you have any neurological condition</li>
    <li style="margin-bottom:8px">🔉 <strong>Start at low volume</strong> — 10% or below on first use</li>
    <li style="margin-bottom:8px">🛑 <strong>Stop immediately</strong> if you feel dizziness, nausea, headache, or discomfort</li>
    <li style="margin-bottom:8px">🚫 <strong>Gamma frequencies</strong> (30-40 Hz) are disabled by default for safety</li>
    <li style="margin-bottom:8px">🔒 Volume is <strong>hard-capped at 25%</strong> system output — cannot be overridden</li>
    <li style="margin-bottom:8px">👁️ Do not use while operating heavy machinery or driving</li>
    <li style="margin-bottom:8px">💤 Sleep mode auto-activates at 22:00 with Delta waves</li>
  </ul>
  <h2>Volume Safety</h2>
  <p>TuneSoar enforces a <strong>maximum volume of 25%</strong>. The default is 10%. You cannot override this cap. Prolonged exposure to audio at high volumes can cause hearing damage regardless of frequency.</p>
  <h2>Medical Disclaimer</h2>
  <p>TuneSoar is not a medical device. It is not intended to diagnose, treat, cure, or prevent any disease. Binaural beats are an experimental audio technique. Effects vary by individual and are not clinically proven for all use cases.</p>
  <h2>If You Experience Issues</h2>
  <p>Stop using TuneSoar immediately and consult a healthcare professional if you experience any adverse effects.</p>
</div>
`, "/safety");
