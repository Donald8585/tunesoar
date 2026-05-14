// ── Desktop Auth (Path C) — system-browser OAuth flow ──
// User signs in on tunesoar.com (production Clerk domain),
// receives a signed JWT, redirected back to tunesoar:// app.

import type { Context } from "hono";

interface Env {
  CLERK_SECRET_KEY: string;
  LICENSE_SECRET: string;
}

function b64url(buf: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "";
  for (let i = 0; i < buf.length; i += 3) {
    const b0 = buf[i];
    const b1 = i + 1 < buf.length ? buf[i + 1] : 0;
    const b2 = i + 2 < buf.length ? buf[i + 2] : 0;
    s += chars[b0 >> 2];
    s += chars[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < buf.length) s += chars[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < buf.length) s += chars[b2 & 63];
  }
  return s;
}

export async function signDesktopToken(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const header = enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = enc.encode(JSON.stringify(payload));
  const input = b64url(header) + "." + b64url(body);
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return input + "." + b64url(new Uint8Array(sig));
}

async function getClerkUser(
  clerkToken: string,
): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const res = await fetch("https://api.clerk.com/v1/me", {
      headers: { Authorization: `Bearer ${clerkToken}` },
    });
    if (!res.ok) return null;
    const user = await res.json() as any;
    const emails = user.email_addresses || [];
    const primary = emails.find((e: any) =>
      e.id === user.primary_email_address_id,
    );
    return {
      id: user.id,
      email: primary?.email_address || "",
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "User",
    };
  } catch {
    return null;
  }
}

export async function handleDesktopToken(c: Context<{ Bindings: Env }>) {
  const env = c.env;
  let body: any;
  try { body = await c.req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { clerk_token: clerkToken, state } = body || {};
  if (!clerkToken || !state) {
    return Response.json({ error: "clerk_token and state required" }, { status: 400 });
  }

  const user = await getClerkUser(clerkToken);
  if (!user) {
    return Response.json({ error: "Invalid Clerk token" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signDesktopToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + 86400,
    state,
  }, env.LICENSE_SECRET);

  return Response.json({ token });
}

export function desktopAuthPage(returnUrl: string, state: string): string {
  const stateEsc = JSON.stringify(state);
  const returnUrlEsc = JSON.stringify(returnUrl);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Sign In — TuneSoar Desktop</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e4e4ec;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#12121a;border:1px solid #2a2a3a;border-radius:16px;padding:40px;max-width:420px;width:100%;text-align:center;margin:16px}
h1{font-size:1.5rem;margin-bottom:8px;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
p{color:#8a8a9a;font-size:.9rem;margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:10px;font-size:.95rem;font-weight:600;text-decoration:none;transition:all .15s;cursor:pointer;border:1px solid #2a2a3a;background:#12121a;color:#c4c4d4;margin:6px}
.btn:hover{background:#1a1a28;border-color:#4747ff;color:#fff}
.btn.primary{background:linear-gradient(135deg,#6b21ff,#4747ff);border-color:transparent;color:#fff}
.btn.primary:hover{opacity:.85}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid #2a2a3a;border-top-color:#6b21ff;border-radius:50%;animation:spin .6s linear infinite;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.error{background:#2d1111;border:1px solid #5c1a1a;color:#f87171;padding:12px;border-radius:8px;font-size:.85rem;margin-bottom:16px;display:none}
.success{background:#0d2818;border:1px solid #1a5c2a;color:#4ade80;padding:12px;border-radius:8px;font-size:.85rem;margin-bottom:16px;display:none}
.footer{font-size:.75rem;color:#555;margin-top:24px}
</style>
<script async crossorigin src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  data-clerk-publishable-key="pk_live_Y2xlcmsudHVuZXNvYXIuY29tJA">
</script>
</head>
<body>
<div class="card">
  <svg width="48" height="48" viewBox="0 0 128 128" style="margin:0 auto 16px"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs><rect x="18" y="46" width="8" height="36" rx="4" fill="url(#g)" opacity=".7"/><rect x="32" y="32" width="8" height="64" rx="4" fill="url(#g)"/><rect x="46" y="22" width="8" height="84" rx="4" fill="url(#g)"/><circle cx="72" cy="64" r="22" fill="url(#g)"/><circle cx="72" cy="64" r="10" fill="#fff" opacity=".9"/><rect x="104" y="22" width="8" height="84" rx="4" fill="url(#g)"/><rect x="118" y="32" width="8" height="64" rx="4" fill="url(#g)" opacity=".7"/></svg>
  <h1>Sign in to TuneSoar</h1>
  <p>You'll be redirected back to the desktop app after signing in.</p>
  <div id="error" class="error"></div>
  <div id="success" class="success">Signed in! Redirecting to app…</div>
  <div id="content">
    <div style="padding:20px"><span class="spinner"></span> Loading…</div>
  </div>
  <div class="footer">Wealth Maker Masterclass Limited</div>
</div>
<script>
(function(){
  var state = ${stateEsc};
  var returnUrl = ${returnUrlEsc};

  function showEl(id) { var e = document.getElementById(id); if (e) e.style.display = "block"; }
  function setHtml(id, html) { var e = document.getElementById(id); if (e) e.innerHTML = html; }

  function showButtons() {
    if (!window.Clerk) return;
    // If already signed in, exchange token immediately
    if (window.Clerk.session) {
      setHtml("content", '<div style="padding:20px"><span class="spinner"></span> Exchanging session…</div>');
      exchangeToken();
      return;
    }
    // Show sign-in / sign-up buttons using Clerk's URL builder
    var signInUrl = window.Clerk.buildSignInUrl({ redirectUrl: returnUrl });
    var signUpUrl = window.Clerk.buildSignUpUrl({ redirectUrl: returnUrl });
    setHtml("content",
      '<a href="' + signInUrl + '" class="btn primary">Sign In with Browser</a>' +
      '<a href="' + signUpUrl + '" class="btn">Create Account</a>'
    );
  }

  async function exchangeToken() {
    try {
      if (!window.Clerk || !window.Clerk.session) {
        showEl("error");
        setHtml("error", "No session found. Please sign in above.");
        showButtons();
        return;
      }
      var clerkToken = await window.Clerk.session.getToken();
      var resp = await fetch("/auth/desktop/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerk_token: clerkToken, state: state }),
      });
      var data = await resp.json();
      if (data.token) {
        showEl("success");
        setHtml("content", "");
        // Redirect to desktop app via custom protocol
        setTimeout(function() {
          window.location.href = "tunesoar://auth-callback?token=" + encodeURIComponent(data.token) + "&state=" + encodeURIComponent(state);
        }, 800);
      } else {
        showEl("error");
        setHtml("error", data.error || "Failed to generate token");
        showButtons();
      }
    } catch(e) {
      showEl("error");
      setHtml("error", "Connection error. Please try again.");
      showButtons();
    }
  }

  function waitForClerk() {
    var a = 0;
    var iv = setInterval(function() {
      a++;
      if (window.Clerk) {
        clearInterval(iv);
        window.Clerk.load().then(showButtons).catch(function(e) {
          showEl("error");
          setHtml("error", "Sign-in service unavailable: " + (e.message || "unknown"));
        });
      } else if (a > 100) {
        clearInterval(iv);
        showEl("error");
        setHtml("error", "Sign-in service unavailable. Please check your connection.");
      }
    }, 200);
  }

  if (window.Clerk) {
    window.Clerk.load().then(showButtons).catch(function() { waitForClerk(); });
  } else {
    waitForClerk();
  }
})();
</script>
</body>
</html>`;
}
