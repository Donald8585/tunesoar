import { Hono } from "hono";
import { cors } from "hono/cors";
import { verifyToken } from "@clerk/backend";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  CLERK_SECRET_KEY: string;
  LICENSE_SECRET: string;
  STRIPE_MONTHLY_PRICE_ID: string;
  STRIPE_LIFETIME_PRICE_ID: string;
  GITHUB_TOKEN: string;
}

interface LicenseRow {
  id: string;
  user_id: string;
  email: string;
  plan: "monthly" | "lifetime";
  key: string;
  devices: string;
  created_at: number;
  expires_at: number | null;
  active: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LICENSE_LENGTH = 24;
const MAX_DEVICES = 3;

function generateLicenseKey(): string {
  const arr = new Uint8Array(LICENSE_LENGTH);
  crypto.getRandomValues(arr);
  let key = "AT-";
  for (let i = 0; i < LICENSE_LENGTH; i++) key += LICENSE_ALPHABET[arr[i] & 31];
  return key;
}

function parseDevices(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

async function hashDevice(secret: string, fingerprint: string): Promise<string> {
  const e = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", e.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, e.encode(fingerprint));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function clerkAuth(env: Env, req: Request): Promise<{ userId: string } | Response> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return jsonError("Missing Authorization header", 401);
  try {
    const r = await verifyToken(h.slice(7), { secretKey: env.CLERK_SECRET_KEY });
    const p = r.data as { sub?: string } | undefined;
    if ("errors" in r || !p?.sub) return jsonError("Invalid session token", 401);
    return { userId: p.sub };
  } catch { return jsonError("Invalid token", 401); }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

// ────────────────────────── Payment & Licensing ──────────────────────────

app.post("/checkout", async (c) => {
  const env = c.env;
  const auth = await clerkAuth(env, c.req.raw);
  if (auth instanceof Response) return auth;
  let b: any; try { b = await c.req.json(); } catch { return jsonError("Invalid JSON"); }
  if (b.plan !== "monthly" && b.plan !== "lifetime") return jsonError("plan must be 'monthly' or 'lifetime'");
  if (!b.success_url || !b.cancel_url) return jsonError("success_url and cancel_url required");
  const priceId = b.plan === "monthly" ? env.STRIPE_MONTHLY_PRICE_ID : env.STRIPE_LIFETIME_PRICE_ID;
  if (!priceId || priceId === "CHANGEME") return jsonError("Price ID not configured", 500);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() });
  try {
    const s = await stripe.checkout.sessions.create({
      mode: b.plan === "monthly" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: b.success_url, cancel_url: b.cancel_url,
      client_reference_id: auth.userId, metadata: { plan: b.plan, user_id: auth.userId },
    });
    return Response.json({ url: s.url });
  } catch (e: any) { return jsonError(e.message, 500); }
});

app.post("/webhook", async (c) => {
  const env = c.env;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia", httpClient: Stripe.createFetchHttpClient() });
  const sig = c.req.header("stripe-signature"); if (!sig) return jsonError("Missing signature", 400);
  let event: Stripe.Event;
  try { event = await stripe.webhooks.constructEventAsync(await c.req.raw.text(), sig, env.STRIPE_WEBHOOK_SECRET); }
  catch { return jsonError("Invalid signature", 400); }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const meta = s.metadata ?? {};
    const plan = (meta.plan as "monthly"|"lifetime") ?? "monthly";
    const uid = meta.user_id ?? "unknown";
    const email = s.customer_details?.email ?? s.customer_email ?? "unknown";
    const now = Math.floor(Date.now()/1000);
    const expiresAt = plan === "lifetime" ? null : now + 30*86400;
    const key = generateLicenseKey();
    await env.DB.prepare(`INSERT INTO licenses (id,user_id,email,plan,key,devices,created_at,expires_at,active) VALUES (?,?,?,?,?,'[]',?,?,1)`)
      .bind(crypto.randomUUID(),uid,email,plan,key,now,expiresAt).run();
  }
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await env.DB.prepare(`UPDATE licenses SET active=0 WHERE user_id=? AND plan='monthly' AND active=1`)
      .bind((sub.customer as string)?? "unknown").run();
  }
  return Response.json({ received: true });
});

app.post("/verify-license", async (c) => {
  const env = c.env;
  let b: any; try { b = await c.req.json(); } catch { return jsonError("Invalid JSON"); }
  if (!b.key || !b.device_id) return jsonError("key and device_id required");
  const nk = b.key.trim().toUpperCase();
  const row = await env.DB.prepare(`SELECT * FROM licenses WHERE key=? LIMIT 1`).bind(nk).first<LicenseRow>();
  if (!row) return Response.json({ valid: false, reason: "license_not_found" });
  if (row.active !== 1) return Response.json({ valid: false, reason: "license_inactive" });
  if (row.expires_at && Math.floor(Date.now()/1000) > row.expires_at) return Response.json({ valid: false, reason: "license_expired" });
  const devices = parseDevices(row.devices);
  const dh = await hashDevice(env.LICENSE_SECRET, b.device_id);
  if (!devices.includes(dh)) {
    if (devices.length >= MAX_DEVICES) return Response.json({ valid: false, reason: "device_limit_reached", devices: devices.length, max: MAX_DEVICES });
    devices.push(dh);
    await env.DB.prepare(`UPDATE licenses SET devices=? WHERE id=?`).bind(JSON.stringify(devices),row.id).run();
  }
  return Response.json({ valid: true, plan: row.plan, email: row.email, devices: devices.length, max_devices: MAX_DEVICES, expires_at: row.expires_at, created_at: row.created_at });
});

app.post("/deactivate", async (c) => {
  const env = c.env;
  const auth = await clerkAuth(env, c.req.raw);
  if (auth instanceof Response) return auth;
  let b: any; try { b = await c.req.json(); } catch { return jsonError("Invalid JSON"); }
  if (!b.key || !b.device_id) return jsonError("key and device_id required");
  const nk = b.key.trim().toUpperCase();
  const row = await env.DB.prepare(`SELECT * FROM licenses WHERE key=? LIMIT 1`).bind(nk).first<LicenseRow>();
  if (!row) return jsonError("License not found", 404);
  if (row.user_id !== auth.userId) return jsonError("Not your license", 403);
  const devices = parseDevices(row.devices);
  const dh = await hashDevice(env.LICENSE_SECRET, b.device_id);
  const nd = devices.filter(d => d !== dh);
  if (nd.length === devices.length) return jsonError("Device not found", 404);
  await env.DB.prepare(`UPDATE licenses SET devices=? WHERE id=?`).bind(JSON.stringify(nd),row.id).run();
  return Response.json({ success: true, devices_remaining: nd.length });
});

// ────────────────────────── Release CDN ──────────────────────────────────

const REPO_OWNER = "Donald8585";
const REPO_NAME = "tunesoar";

function assetPattern(platform: string, arch: string): RegExp {
  const m: Record<string, RegExp> = {
    "windows-x64": /TuneSoar_.*_x64-setup\.exe$/,
    "macos-x64": /TuneSoar_.*_x64\.dmg$/,
    "macos-arm64": /TuneSoar_.*_aarch64\.dmg$/,
    "linux-x64": /[Tt]unesoar_.*_amd64\.AppImage$/,
    "linux-arm64": /[Tt]unesoar_.*_arm64\.AppImage$/,
  };
  return m[`${platform}-${arch}`] ?? /./;
}

app.get("/releases/latest/:platform/:arch", async (c) => {
  const platform = c.req.param("platform"), arch = c.req.param("arch");
  const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "tunesoar-worker", Accept: "application/vnd.github.v3+json" },
  });
  if (!resp.ok) return Response.json({ error: "Failed to fetch release" }, { status: 502 });
  const release: any = await resp.json();
  const asset = release.assets?.find((a: any) => assetPattern(platform, arch).test(a.name));
  if (!asset) return Response.json({ error: "No matching asset", platform, arch }, { status: 404 });
  const dl = await fetch(asset.url, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "tunesoar-worker", Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!dl.ok) return Response.json({ error: "Download failed" }, { status: 502 });
  return new Response(dl.body, {
    status: 200,
    headers: {
      "Content-Type": dl.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asset.name}"`,
      "Content-Length": dl.headers.get("Content-Length") ?? asset.size?.toString() ?? "0",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

app.get("/releases/updater/:target/:arch/:current_version", async (c) => {
  const target = c.req.param("target"), arch = c.req.param("arch"), cv = c.req.param("current_version");
  const resp = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "tunesoar-updater", Accept: "application/vnd.github.v3+json" },
  });
  if (!resp.ok) return Response.json({ error: "Failed to fetch release" }, { status: 502 });
  const release: any = await resp.json();
  const lv = (release.tag_name ?? "v0.0.0").replace(/^v/, "");
  if (lv === cv.replace(/^v/, "")) return new Response(null, { status: 204 });
  const sp = new RegExp(`TuneSoar_.*_${arch}.*\\.(exe\\.zip\\.sig|app\\.tar\\.gz\\.sig|AppImage\\.tar\\.gz\\.sig)$`, "i");
  const sa = release.assets?.find((a: any) => sp.test(a.name));
  if (!sa) return new Response(null, { status: 204 });
  const sr = await fetch(sa.url, {
    headers: { Authorization: `Bearer ${c.env.GITHUB_TOKEN}`, "User-Agent": "tunesoar-updater", Accept: "application/octet-stream" },
  });
  const signature = await sr.text();
  const host = c.req.header("host") ?? "tunesoar.com";
  const url = `https://${host}/releases/latest/${target === "darwin" ? "macos" : target}/${arch}`;
  return Response.json({ version: `v${lv}`, notes: release.body ?? "", pub_date: release.published_at ?? new Date().toISOString(), platforms: { [target]: { signature, url } } });
});

// ────────────────────────── Landing Page ────────────────────────────────

const LANDING = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TuneSoar — Context-Aware Binaural Beats</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0f;color:#e4e4ec;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.card{max-width:560px;padding:48px 32px}
svg.logo{width:64px;height:auto;margin-bottom:24px}
h1{font-size:2rem;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#863bff,#47bfff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
p.sub{color:#8a8a9a;font-size:1.05rem;margin-bottom:32px;line-height:1.6}
.platforms{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:10px;font-size:.9rem;font-weight:600;text-decoration:none;transition:all .15s;border:1px solid #2a2a3a;background:#12121a;color:#c4c4d4}
.btn:hover{background:#1a1a28;border-color:#4747ff;color:#fff}
.btn.primary{background:linear-gradient(135deg,#6b21ff,#4747ff);border-color:transparent;color:#fff}
.btn.primary:hover{opacity:.9}
code{display:block;background:#12121a;border:1px solid #2a2a3a;border-radius:8px;padding:12px 16px;margin:8px 0;font-size:.82rem;color:#8a8afa;word-break:break-all}
.footer{margin-top:32px;font-size:.78rem;color:#555}
.footer a{color:#555;text-decoration:none}
</style>
</head>
<body>
<div class="card">
<svg class="logo" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 46"><path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>
<h1>TuneSoar</h1>
<p class="sub">Context-aware binaural beats that auto-deploy based on what you're doing.<br>Coding? Beta waves. Writing? Alpha. Gaming? Focus mode. Zero manual switching.</p>
<h3 style="font-size:.95rem;color:#aaa;margin-bottom:12px">Install</h3>
<div class="platforms">
<a class="btn" href="/releases/latest/windows/x64">🖥 Windows (.exe)</a>
<a class="btn" href="/releases/latest/macos/arm64">🍎 macOS Apple Silicon</a>
<a class="btn" href="/releases/latest/macos/x64">🍎 macOS Intel</a>
<a class="btn" href="/releases/latest/linux/x64">🐧 Linux (x64)</a>
</div>
<details style="margin-top:20px;text-align:left">
<summary style="cursor:pointer;color:#8a8afa;font-size:.85rem">Or use the one-liner</summary>
<p style="color:#8a8a9a;font-size:.78rem;margin:8px 0 4px">macOS / Linux:</p>
<code>curl -fsSL https://tunesoar.com/install.sh | bash</code>
<p style="color:#8a8a9a;font-size:.78rem;margin:16px 0 4px">Windows (PowerShell):</p>
<code>irm https://tunesoar.com/install.ps1 | iex</code>
</details>
<p class="footer">
<a href="https://github.com/Donald8585/tunesoar">GitHub</a> &middot; TranceLab
</p>
</div>
</body>
</html>`;

app.get("/", (c) => new Response(LANDING, { headers: { "Content-Type": "text/html; charset=utf-8" } }));

// ────────────────────────── Install Scripts ─────────────────────────────

const INSTALL_SH = `#!/usr/bin/env bash
set -euo pipefail
BOLD="\\\\033[1m"; GREEN="\\\\033[0;32m"; RED="\\\\033[0;31m"; NC="\\\\033[0m"
log(){ echo -e "\${GREEN}==>\${NC} \${BOLD}\$*\${NC}"; }
die(){ echo -e "\${RED}✗\${NC}  \$*">&2; exit 1; }
OS=\$(uname -s); ARCH=\$(uname -m)
case "\$OS" in Darwin) P="macos";; Linux) P="linux";; *) die "Unsupported OS";; esac
case "\$ARCH" in x86_64|amd64) A="x64";; arm64|aarch64) A="arm64";; *) die "Unsupported arch";; esac
U="https://tunesoar.com/releases/latest/\${P}/\${A}"
log "Detected: \$P / \$A"; log "Downloading TuneSoar..."
T=\$(mktemp -d); trap 'rm -rf "\$T"' EXIT; cd "\$T"
if [ "\$P" = "macos" ]; then
  curl -fsSL -o TuneSoar.dmg "\$U" || die "Download failed"
  hdiutil attach TuneSoar.dmg -nobrowse -quiet
  cp -R "/Volumes/TuneSoar/TuneSoar.app" /Applications/
  hdiutil detach "/Volumes/TuneSoar" -quiet
  log "Done! Launch from /Applications/TuneSoar.app"
else
  curl -fsSL -o tunesoar "\$U" || die "Download failed"
  chmod +x tunesoar; mkdir -p "\$HOME/.local/bin"
  mv tunesoar "\$HOME/.local/bin/tunesoar"
  mkdir -p "\$HOME/.local/share/applications"
  printf '[Desktop Entry]\\nName=TuneSoar\\nComment=Context-Aware Binaural Beats\\nExec=%s/.local/bin/tunesoar\\nIcon=tunesoar\\nTerminal=false\\nType=Application\\nCategories=Audio;Utility;\\n' "\$HOME" > "\$HOME/.local/share/applications/tunesoar.desktop"
  log "Done! Run: tunesoar"
fi
echo""; echo -e "  \${GREEN}✓ TuneSoar installed!\${NC}"; echo
`;

const INSTALL_PS1 = `# TuneSoar one-liner (Windows)
param(\$Version="latest")
\$ErrorActionPreference="Stop"
Write-Host "==> TuneSoar Installer (Windows)" -ForegroundColor Green
if(-not[Environment]::Is64BitOperatingSystem){Write-Error"64-bit required";exit 1}
Write-Host"Detected: Windows/x64"
\$U="https://tunesoar.com/releases/latest/windows/x64"
\$T=Join-Path \$env:TEMP"tunesoar-install";New-Item-Type Directory-Force-Path \$T|Out-Null
\$I=Join-Path \$T"TuneSoar-Setup.exe"
Write-Host"Downloading...";Invoke-WebRequest-Uri \$U-OutFile \$I
Write-Host"Installing...";Start-Process-FilePath \$I-ArgumentList"/S"-Wait
Remove-Item-Recurse-Force \$T-ErrorAction SilentlyContinue
Write-Host"✓ TuneSoar installed!"-ForegroundColor Green
`;

app.get("/install.sh", (c) => new Response(INSTALL_SH, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
app.get("/install.ps1", (c) => new Response(INSTALL_PS1, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
app.get("/health", () => Response.json({ ok: true }));

export default app;
